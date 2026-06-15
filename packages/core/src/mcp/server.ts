import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { AmhStore } from "../store/interface.js";
import { createStore, storeOptionsFromConfig, type StoreOptions } from "../store/factory.js";
import { loadConfig, resolveGovernance, type AmhConfig } from "../config.js";
import { AMH_VERSION } from "../version.js";
import { writeMemory } from "../operations/write.js";
import { readMemory, queryMemories } from "../operations/read.js";
import { transferMemory } from "../operations/transfer.js";
import { getAuditLog } from "../operations/audit.js";
import { registerAmhResources } from "./resources.js";

export interface ServerOptions extends StoreOptions {
  configPath?: string;
  callerNamespace?: string;
}

export interface AmhServerContext {
  store: AmhStore;
  config: AmhConfig;
  governance: ReturnType<typeof resolveGovernance>;
  callerNamespace?: string;
}

export async function createAmhContext(opts: ServerOptions = {}): Promise<AmhServerContext> {
  const config = await loadConfig(opts.configPath);
  const store = createStore(storeOptionsFromConfig(config, opts));
  const governance = resolveGovernance(config);
  const callerNamespace = opts.callerNamespace ?? config.caller_namespace;
  return { store, config, governance, callerNamespace };
}

export function createAmhServer(context: AmhServerContext) {
  const { store, governance, callerNamespace } = context;

  const server = new McpServer({
    name: "agent-memory-hall",
    version: AMH_VERSION,
  });

  const readCtx = {
    callerNamespace,
    namespaceIsolation: governance.namespaceIsolation,
  };

  const gateConfig = {
    dedup: governance.dedup,
    antiOuroboros: governance.antiOuroboros,
    namespaceIsolation: governance.namespaceIsolation,
    writeGate: governance.writeGate,
  };

  registerAmhResources(server, store, readCtx);

  server.tool(
    "amh_write",
    "Write a memory record with governance checks (dedup, source tier, anti-Ouroboros, namespace isolation)",
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
          store,
          gateConfig,
          { callerNamespace }
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
              text: JSON.stringify(
                {
                  error: err instanceof Error ? err.message : String(err),
                  error_type: err instanceof Error ? err.name : "Error",
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "amh_read",
    "Query memories by ID, namespace, type, or agent (expired records filtered by default)",
    {
      memory_id: z.string().optional().describe("Specific memory ID to fetch"),
      namespace: z.string().optional().describe("Filter by namespace"),
      memory_type: z.enum(["decision", "fact", "preference", "constraint", "lesson", "risk"]).optional(),
      agent_id: z.string().optional().describe("Filter by agent"),
      text: z.string().optional().describe("Text search in content"),
      limit: z.number().optional().default(20),
      include_expired: z.boolean().optional().default(false),
    },
    async (params) => {
      const ctx = {
        ...readCtx,
        filterExpired: !params.include_expired,
      };

      if (params.memory_id) {
        const record = await readMemory(params.memory_id, store, ctx);
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
        store,
        ctx
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
        const result = await transferMemory(
          {
            memory_id: params.memory_id,
            target_namespace: params.target_namespace,
            target_agent: params.target_agent,
            transferred_by: params.transferred_by,
          },
          store,
          gateConfig,
          { callerNamespace }
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
              text: JSON.stringify(
                {
                  error: err instanceof Error ? err.message : String(err),
                  error_type: err instanceof Error ? err.name : "Error",
                },
                null,
                2
              ),
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
      const record = await readMemory(params.memory_id, store, readCtx);
      if (!record) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify([], null, 2),
            },
          ],
        };
      }
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
    "Get AMH server status: record count, namespaces, store info, governance config",
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
                version: AMH_VERSION,
                records: recordCount,
                namespaces: ns,
                caller_namespace: callerNamespace ?? null,
                governance: {
                  dedup: governance.dedup,
                  anti_ouroboros: governance.antiOuroboros,
                  namespace_isolation: governance.namespaceIsolation,
                  write_gate: governance.writeGate,
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

export async function startServer(opts?: ServerOptions): Promise<void> {
  const context = await createAmhContext(opts);
  const server = createAmhServer(context);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}