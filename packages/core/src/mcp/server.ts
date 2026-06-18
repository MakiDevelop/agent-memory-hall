import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { AmhStore } from "../store/interface.js";
import { createStore, storeOptionsFromConfig, type StoreOptions } from "../store/factory.js";
import { loadConfig, resolveGovernance, resolveIdentityConfig, type AmhConfig } from "../config.js";
import { AMH_VERSION } from "../version.js";
import { writeMemory } from "../operations/write.js";
import { readMemory, queryMemories } from "../operations/read.js";
import { transferMemory } from "../operations/transfer.js";
import { revokeMemory } from "../operations/revoke.js";
import { expireMemory } from "../operations/expire.js";
import { tierUpgrade } from "../operations/tier-upgrade.js";
import { getAuditLog } from "../operations/audit.js";
import { registerAmhResources } from "./resources.js";
import { SqliteIdentityStore } from "../identity/sqlite-identity-store.js";
import type { IdentityStore } from "../identity/store.js";
import type { GrantPermission, PrincipalType } from "../identity/types.js";
import { authorize, registerPrincipal } from "../identity/operations.js";
import { MemhallStore, MemhallApiError } from "../store/memhall.js";

export interface ServerOptions extends StoreOptions {
  configPath?: string;
  callerNamespace?: string;
}

export interface AmhServerContext {
  store: AmhStore;
  identityStore?: IdentityStore;
  config: AmhConfig;
  governance: ReturnType<typeof resolveGovernance>;
  identity: ReturnType<typeof resolveIdentityConfig>;
  callerNamespace?: string;
}

export async function createAmhContext(opts: ServerOptions = {}): Promise<AmhServerContext> {
  const config = await loadConfig(opts.configPath);
  const store = createStore(storeOptionsFromConfig(config, opts));
  const governance = resolveGovernance(config);
  const identity = resolveIdentityConfig(config);
  const identityStore = hasSqliteDb(store) ? new SqliteIdentityStore((store as any).db) : undefined;
  const callerNamespace = opts.callerNamespace ?? config.caller_namespace;
  return { store, identityStore, config, governance, identity, callerNamespace };
}

function hasSqliteDb(store: AmhStore): boolean {
  return "db" in store && typeof (store as any).db?.prepare === "function";
}

export function createAmhServer(context: AmhServerContext) {
  const { store, governance, identity, identityStore, callerNamespace } = context;

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
    "amh_register_principal",
    "Register a Layer 3 identity principal in the SQLite identity store",
    {
      principal_id: z.string().describe("Principal ID, e.g. human:maki or agent:planner"),
      principal_type: z.enum(["human", "agent", "system"]).describe("Principal type"),
      display_name: z.string().optional().describe("Human-readable display name"),
    },
    async (params) => {
      try {
        if (!identityStore) {
          throw new Error("Identity store is unavailable for this backend");
        }
        const result = await registerPrincipal(
          params.principal_id,
          params.principal_type as PrincipalType,
          params.display_name,
          identityStore,
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
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
    "amh_authorize",
    "Check whether a Layer 3 principal has a namespace permission",
    {
      principal_id: z.string().describe("Principal ID to authorize"),
      namespace_id: z.string().describe("Namespace ID"),
      permission: z.enum(["read", "write", "transfer", "admin"]).describe("Permission to check"),
    },
    async (params) => {
      try {
        if (!identityStore) {
          throw new Error("Identity store is unavailable for this backend");
        }
        const result = await authorize(
          params.principal_id,
          params.namespace_id,
          params.permission as GrantPermission,
          identityStore,
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
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
    "amh_write",
    "Write a memory record with governance checks (dedup, source tier, anti-Ouroboros, namespace isolation)",
    {
      agent_id: z.string().describe("ID of the agent writing the memory"),
      namespace: z.string().describe("Memory namespace (e.g. project:acme)"),
      memory_type: z.enum(["fact", "preference", "constraint", "lesson", "risk"]),
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
      memory_type: z.enum(["fact", "preference", "constraint", "lesson", "risk"]).optional(),
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
              text: record
                ? JSON.stringify(record, null, 2)
                : JSON.stringify({ error: "not_found", memory_id: params.memory_id }, null, 2),
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
    "Reassign a memory to another agent within the caller namespace (namespace isolation blocks cross-namespace targets), preserving provenance",
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
    "amh_forget",
    "Revoke a memory (soft delete): marks status revoked, appends audit, hides from default reads",
    {
      memory_id: z.string().describe("ID of memory to revoke"),
      revoked_by: z.string().describe("Agent performing the revocation"),
      reason: z.string().optional().describe("Optional reason for audit trail"),
    },
    async (params) => {
      try {
        const result = await revokeMemory(
          {
            memory_id: params.memory_id,
            revoked_by: params.revoked_by,
            reason: params.reason,
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
    "amh_expire",
    "Expire a memory: marks status expired, appends audit, hides from default reads",
    {
      memory_id: z.string().describe("ID of memory to expire"),
      expired_by: z.string().describe("Agent performing the expiration"),
      reason: z.string().optional().describe("Optional reason for audit trail"),
    },
    async (params) => {
      try {
        const result = await expireMemory(
          {
            memory_id: params.memory_id,
            expired_by: params.expired_by,
            reason: params.reason,
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
    "amh_tier_upgrade",
    "Upgrade a memory's source tier (raw_source → llm_derived → human_confirmed). Requires a trust proof for human_confirmed.",
    {
      memory_id: z.string().describe("Memory ID to upgrade"),
      new_tier: z.enum(["llm_derived", "human_confirmed"]).describe("Target tier (must be higher than current)"),
      confirmed_by: z.string().describe("Who confirmed this upgrade (agent or human ID)"),
      method: z.enum(["human_review", "peer_consensus", "automated_check", "cross_reference"]).default("human_review"),
      evidence_ids: z.array(z.string()).default([]).describe("IDs of supporting evidence"),
    },
    async (params) => {
      try {
        const result = await tierUpgrade(
          params.memory_id,
          params.new_tier,
          {
            tier: params.new_tier,
            confirmed_by: params.confirmed_by,
            confirmed_at: new Date().toISOString(),
            evidence_ids: params.evidence_ids,
            method: params.method,
          },
          store,
          { callerNamespace },
          {
            enabled: identity.enabled,
            enforceHumanTier: identity.enforceHumanTier,
            identityStore,
          },
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
      const record = await readMemory(params.memory_id, store, {
        ...readCtx,
        filterInactive: false,
      });
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
                identity: {
                  enabled: identity.enabled,
                  enforce_human_tier: identity.enforceHumanTier,
                  store_available: Boolean(identityStore),
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

  if (store instanceof MemhallStore) {
    server.tool(
      "amh_baton_read",
      "Read the session baton for a namespace (Loop Engineering state handoff)",
      {
        namespace: z.string().describe("Baton namespace (e.g. 'home', 'project:memory-hall')"),
      },
      async (params) => {
        try {
          const result = await (store as MemhallStore).batonRead(params.namespace);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          };
        } catch (err) {
          return {
            content: [{ type: "text" as const, text: `baton_read failed: ${err instanceof Error ? err.message : String(err)}` }],
            isError: true,
          };
        }
      }
    );

    server.tool(
      "amh_baton_write",
      "Write the session baton for a namespace (Loop Engineering state handoff). Pass expected_revision for CAS; omit for LWW.",
      {
        namespace: z.string().describe("Baton namespace"),
        baton: z.record(z.unknown()).describe("Baton data object"),
        expected_revision: z.number().int().nonnegative().optional().describe("Expected revision for CAS (omit for last-write-wins)"),
      },
      async (params) => {
        try {
          const result = await (store as MemhallStore).batonWrite(
            params.namespace,
            params.baton as Record<string, unknown>,
            params.expected_revision
          );
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const isConflict = err instanceof MemhallApiError && err.status === 409;
          return {
            content: [{ type: "text" as const, text: isConflict ? `CAS conflict: ${message}` : `baton_write failed: ${message}` }],
            isError: true,
          };
        }
      }
    );
  }

  return server;
}

export async function startServer(opts?: ServerOptions): Promise<void> {
  const context = await createAmhContext(opts);
  const server = createAmhServer(context);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
