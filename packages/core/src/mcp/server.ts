import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { JsonFileStore } from "../store/json-file.js";
import { SqliteStore } from "../store/sqlite.js";
import { PostgresStore } from "../store/postgres.js";
import { MemhallStore } from "../store/memhall.js";
import type { AmhStore } from "../store/interface.js";
import { writeMemory } from "../operations/write.js";
import { readMemory, queryMemories } from "../operations/read.js";
import { transferMemory } from "../operations/transfer.js";
import { getAuditLog } from "../operations/audit.js";

export interface ServerOptions {
  storePath?: string;
  storeType?: "json" | "sqlite" | "postgres" | "memhall";
  memhallToken?: string;
}

function createStore(opts: ServerOptions): AmhStore {
  const type = opts.storeType ?? "sqlite";
  if (type === "memhall") {
    const url = opts.storePath ?? "http://100.89.41.50:9100";
    const token = opts.memhallToken ?? process.env.MH_API_TOKEN ?? "";
    if (!token) {
      throw new Error("Memhall store requires MH_API_TOKEN env var or --token flag");
    }
    return new MemhallStore(url, token);
  }
  if (type === "postgres") {
    if (!opts.storePath) {
      throw new Error("Postgres store requires --path with a connection string (e.g. postgres://user:pass@localhost:5432/amh)");
    }
    return new PostgresStore(opts.storePath);
  }
  if (type === "sqlite") {
    return new SqliteStore(opts.storePath);
  }
  return new JsonFileStore(opts.storePath);
}

export function createAmhServer(optsOrPath?: string | ServerOptions) {
  const opts: ServerOptions = typeof optsOrPath === "string"
    ? { storePath: optsOrPath }
    : optsOrPath ?? {};
  const store = createStore(opts);

  const server = new McpServer({
    name: "agent-memory-hall",
    version: "0.1.0",
  });

  server.tool(
    "amh_write",
    "Write a memory record with governance checks (dedup, source tier, anti-Ouroboros)",
    {
      agent_id: z.string().describe("ID of the agent writing the memory"),
      namespace: z.string().describe("Memory namespace (e.g. project:acme)"),
      memory_type: z.enum(["decision", "fact", "preference", "constraint", "lesson", "risk"]),
      content: z.string().describe("The memory content"),
      source_type: z.enum(["human", "agent", "system", "document"]).default("agent"),
      source_ref: z.string().default("").describe("Source reference (URI or identifier)"),
      source_tier: z.enum(["raw_source", "llm_derived", "human_confirmed"]).default("llm_derived"),
      valid_until: z.string().optional().describe("ISO 8601 expiry for the fact"),
      supersedes: z.string().optional().describe("memory_id this replaces"),
    },
    async (params) => {
      try {
        const result = await writeMemory(
          {
            agent_id: params.agent_id,
            namespace: params.namespace,
            memory_type: params.memory_type,
            content: params.content,
            source_type: params.source_type,
            source_ref: params.source_ref,
            source_tier: params.source_tier,
            valid_until: params.valid_until,
            supersedes: params.supersedes,
          },
          store
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "amh_read",
    "Query memories by ID, namespace, type, or agent",
    {
      memory_id: z.string().optional().describe("Specific memory ID to fetch"),
      namespace: z.string().optional().describe("Filter by namespace"),
      memory_type: z.enum(["decision", "fact", "preference", "constraint", "lesson", "risk"]).optional(),
      agent_id: z.string().optional().describe("Filter by agent"),
      text: z.string().optional().describe("Text search in content"),
      limit: z.number().optional().default(20),
    },
    async (params) => {
      if (params.memory_id) {
        const record = await readMemory(params.memory_id, store);
        return {
          content: [
            {
              type: "text" as const,
              text: record ? JSON.stringify(record, null, 2) : "Not found",
            },
          ],
        };
      }
      const results = await queryMemories(
        {
          namespace: params.namespace,
          memory_type: params.memory_type,
          agent_id: params.agent_id,
          text: params.text,
          limit: params.limit,
        },
        store
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "amh_transfer",
    "Transfer a memory to another namespace/agent, preserving provenance",
    {
      memory_id: z.string().describe("ID of memory to transfer"),
      target_namespace: z.string().describe("Destination namespace"),
      target_agent: z.string().describe("Destination agent ID"),
      transferred_by: z.string().describe("Agent performing the transfer"),
    },
    async (params) => {
      try {
        const result = await transferMemory(params, store);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "amh_audit",
    "Get the append-only audit log for a memory record",
    {
      memory_id: z.string().describe("Memory ID to audit"),
    },
    async (params) => {
      const events = await getAuditLog(params.memory_id, store);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(events, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "amh_status",
    "Get AMH server status: record count, namespaces, store info",
    {},
    async () => {
      const recordCount = await store.count();
      const ns = await store.namespaces();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                version: "0.1.0",
                records: recordCount,
                namespaces: ns,
                governance: {
                  dedup: true,
                  anti_ouroboros: true,
                  namespace_isolation: true,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}

export async function startServer(opts?: string | ServerOptions): Promise<void> {
  const server = createAmhServer(opts);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
