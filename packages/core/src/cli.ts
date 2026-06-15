#!/usr/bin/env node

import { startServer, type ServerOptions } from "./mcp/server.js";
import { createAmhContext } from "./mcp/server.js";
import { AMH_VERSION } from "./version.js";
import { writeMemory } from "./operations/write.js";
import { queryMemories, readMemory } from "./operations/read.js";
import { getAuditLog } from "./operations/audit.js";
import { revokeMemory } from "./operations/revoke.js";
import { expireMemory } from "./operations/expire.js";
import { transferMemory } from "./operations/transfer.js";
import { tierUpgrade } from "./operations/tier-upgrade.js";
import { importUmpFile, exportUmpFile } from "./import/ump.js";
import { importMem0File } from "./import/mem0.js";
import { resolveGovernance, resolveIdentityConfig } from "./config.js";
import type { AmhServerContext } from "./mcp/server.js";
import { registerPrincipal } from "./identity/operations.js";
import type { PrincipalType } from "./identity/types.js";

function parseGlobalOpts(args: string[]): { command: string; rest: string[]; opts: ServerOptions } {
  const opts: ServerOptions = {};
  const rest: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--store" && args[i + 1]) {
      opts.storeType = args[++i] as ServerOptions["storeType"];
    } else if (arg === "--path" && args[i + 1]) {
      opts.storePath = args[++i];
    } else if (arg === "--token" && args[i + 1]) {
      opts.memhallToken = args[++i];
    } else if (arg === "--config" && args[i + 1]) {
      opts.configPath = args[++i];
    } else if (arg === "--caller-ns" && args[i + 1]) {
      opts.callerNamespace = args[++i];
    } else {
      rest.push(arg);
    }
  }

  if (rest.length === 0 || rest[0].startsWith("--")) {
    return { command: "serve", rest, opts };
  }

  return { command: rest[0], rest: rest.slice(1), opts };
}

function flagValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : undefined;
}

function positionalArgs(args: string[]): string[] {
  const positional: string[] = [];
  const consumed = new Set<number>();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--") {
      for (let j = i + 1; j < args.length; j++) {
        positional.push(args[j]);
      }
      return positional;
    }
    if (args[i].startsWith("--") && args[i + 1] && !args[i + 1].startsWith("--")) {
      consumed.add(i);
      consumed.add(i + 1);
      i++;
    }
  }

  for (let i = 0; i < args.length; i++) {
    if (!consumed.has(i) && !args[i].startsWith("--")) {
      positional.push(args[i]);
    }
  }

  return positional;
}

function printHelp(): void {
  console.log(`Agent Memory Hall (AMH) v${AMH_VERSION}

Usage:
  amh [serve]                  Start MCP server (SQLite default)
  amh write [options] <content>
  amh read [options]
  amh import --from <ump|mem0> <file>
  amh export --to ump --out <file> [--ns <namespace>]
  amh transfer --id <memory_id> --agent <id> --ns <namespace> --by <agent>
  amh tier-upgrade --id <memory_id> --tier <tier> --by <agent> [--method <method>]
  amh principal register --id <id> --type <human|agent|system> [--name <display>]
  amh principal list
  amh forget --id <memory_id> --by <agent> [--reason <text>]
  amh expire --id <memory_id> --by <agent> [--reason <text>]
  amh audit --id <memory_id>
  amh migrate                 Run DB migrations (decision→fact, content_hash rehash)
  amh status
  amh --help

Global options:
  --store <sqlite|json|postgres|memhall>   Store backend (default: sqlite)
  --path <path|url>                        DB path or Postgres/memhall URL
  --token <token>                          Memhall API token
  --config <path>                          Config file (default: ~/.amh/config.json)
  --caller-ns <namespace>                  Caller namespace for isolation

Write options:
  --agent <id>         Agent ID (required)
  --ns <namespace>     Namespace (required)
  --type <type>        fact|preference|constraint|lesson|risk
  --tier <tier>        raw_source|llm_derived|human_confirmed
  --source-ref <ref>   Source reference

Read options:
  --id <memory_id>     Fetch single record
  --ns <namespace>     Filter namespace
  --type <type>        Filter type
  --agent <id>         Filter agent
  --text <query>       Text search
  --limit <n>          Max results (default 20)

Examples:
  amh write --agent planner --ns project:acme --type fact "Use PostgreSQL"
  amh read --ns project:acme --type fact
  amh principal register --id human:maki --type human --name Maki
  amh import --from ump ./memory.ump.json
  amh --store postgres --path postgres://amh:amh@localhost:5432/amh serve

MCP config:
  {
    "mcpServers": {
      "agent-memory-hall": {
        "command": "npx",
        "args": ["@chibakuma/agent-memory-hall"]
      }
    }
  }
`);
}

function requireIdentityStore(ctx: AmhServerContext) {
  if (!ctx.identityStore) {
    throw new Error("Identity store is only available with the SQLite backend");
  }
  return ctx.identityStore;
}

async function cmdWrite(args: string[], opts: ServerOptions): Promise<void> {
  const agent = flagValue(args, "--agent");
  const ns = flagValue(args, "--ns");
  const type = flagValue(args, "--type") as Parameters<typeof writeMemory>[0]["memory_type"] | undefined;
  const tier = flagValue(args, "--tier") as Parameters<typeof writeMemory>[0]["source_tier"] | undefined;
  const sourceRef = flagValue(args, "--source-ref") ?? "";
  const content = positionalArgs(args).join(" ").trim();

  if (!agent || !ns || !type || !content) {
    console.error("Usage: amh write --agent <id> --ns <namespace> --type <type> <content>");
    process.exit(1);
  }

  const ctx = await createAmhContext(opts);
  const governance = resolveGovernance(ctx.config);
  const result = await writeMemory(
    {
      agent_id: agent,
      namespace: ns,
      memory_type: type,
      content,
      source_type: "agent",
      source_ref: sourceRef,
      source_tier: tier ?? "llm_derived",
    },
    ctx.store,
    {
      dedup: governance.dedup,
      antiOuroboros: governance.antiOuroboros,
      namespaceIsolation: governance.namespaceIsolation,
      writeGate: governance.writeGate,
    },
    { callerNamespace: opts.callerNamespace ?? ctx.callerNamespace }
  );
  console.log(JSON.stringify(result, null, 2));
}

async function cmdRead(args: string[], opts: ServerOptions): Promise<void> {
  const ctx = await createAmhContext(opts);
  const governance = resolveGovernance(ctx.config);
  const readCtx = {
    callerNamespace: opts.callerNamespace ?? ctx.callerNamespace,
    namespaceIsolation: governance.namespaceIsolation,
  };

  const id = flagValue(args, "--id");
  if (id) {
    const record = await readMemory(id, ctx.store, readCtx);
    console.log(
      record
        ? JSON.stringify(record, null, 2)
        : JSON.stringify({ error: "not_found", memory_id: id }, null, 2)
    );
    return;
  }

  const results = await queryMemories(
    {
      namespace: flagValue(args, "--ns"),
      memory_type: flagValue(args, "--type") as Parameters<typeof queryMemories>[0]["memory_type"],
      agent_id: flagValue(args, "--agent"),
      text: flagValue(args, "--text"),
      limit: flagValue(args, "--limit") ? parseInt(flagValue(args, "--limit")!, 10) : 20,
    },
    ctx.store,
    readCtx
  );
  console.log(JSON.stringify(results, null, 2));
}

async function cmdImport(args: string[], opts: ServerOptions): Promise<void> {
  const from = flagValue(args, "--from");
  const file = args.find((a) => !a.startsWith("--") && a !== from);
  if (!from || !file || (from !== "ump" && from !== "mem0")) {
    console.error("Usage: amh import --from <ump|mem0> <file>");
    process.exit(1);
  }

  const records = from === "ump" ? await importUmpFile(file) : await importMem0File(file);
  const ctx = await createAmhContext(opts);
  const governance = resolveGovernance(ctx.config);
  let imported = 0;
  const errors: string[] = [];

  for (const record of records) {
    try {
      await writeMemory(
        {
          agent_id: record.agent_id,
          namespace: record.namespace,
          memory_type: record.memory_type,
          content: record.content.value,
          content_format: record.content.format,
          source_type: record.source.type,
          source_ref: record.source.ref,
          source_tier: record.source.tier,
          valid_until: record.valid_until,
          supersedes: record.supersedes,
        },
        ctx.store,
        {
          dedup: governance.dedup,
          antiOuroboros: governance.antiOuroboros,
          namespaceIsolation: false,
          writeGate: governance.writeGate,
        },
        { callerNamespace: opts.callerNamespace ?? ctx.callerNamespace ?? record.namespace }
      );
      imported++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  console.log(JSON.stringify({ imported, total: records.length, errors }, null, 2));
}

async function cmdExport(args: string[], opts: ServerOptions): Promise<void> {
  const to = flagValue(args, "--to");
  const out = flagValue(args, "--out");
  if (to !== "ump" || !out) {
    console.error("Usage: amh export --to ump --out <file> [--ns <namespace>]");
    process.exit(1);
  }

  const ctx = await createAmhContext(opts);
  const governance = resolveGovernance(ctx.config);
  const records = await queryMemories(
    {
      namespace: flagValue(args, "--ns"),
      limit: 500,
    },
    ctx.store,
    {
      callerNamespace: opts.callerNamespace ?? ctx.callerNamespace,
      namespaceIsolation: governance.namespaceIsolation,
    }
  );

  const exported = await exportUmpFile(records, out);
  console.log(JSON.stringify({ exported, path: out }, null, 2));
}

async function cmdForget(args: string[], opts: ServerOptions): Promise<void> {
  const id = flagValue(args, "--id");
  const by = flagValue(args, "--by");
  const reason = flagValue(args, "--reason");
  if (!id || !by) {
    console.error("Usage: amh forget --id <memory_id> --by <agent> [--reason <text>]");
    process.exit(1);
  }

  const ctx = await createAmhContext(opts);
  const governance = resolveGovernance(ctx.config);
  const result = await revokeMemory(
    {
      memory_id: id,
      revoked_by: by,
      reason,
    },
    ctx.store,
    {
      dedup: governance.dedup,
      antiOuroboros: governance.antiOuroboros,
      namespaceIsolation: governance.namespaceIsolation,
      writeGate: governance.writeGate,
    },
    { callerNamespace: opts.callerNamespace ?? ctx.callerNamespace }
  );
  console.log(JSON.stringify(result, null, 2));
}

async function cmdExpire(args: string[], opts: ServerOptions): Promise<void> {
  const id = flagValue(args, "--id");
  const by = flagValue(args, "--by");
  const reason = flagValue(args, "--reason");
  if (!id || !by) {
    console.error("Usage: amh expire --id <memory_id> --by <agent> [--reason <text>]");
    process.exit(1);
  }

  const ctx = await createAmhContext(opts);
  const governance = resolveGovernance(ctx.config);
  const result = await expireMemory(
    {
      memory_id: id,
      expired_by: by,
      reason,
    },
    ctx.store,
    {
      dedup: governance.dedup,
      antiOuroboros: governance.antiOuroboros,
      namespaceIsolation: governance.namespaceIsolation,
      writeGate: governance.writeGate,
    },
    { callerNamespace: opts.callerNamespace ?? ctx.callerNamespace }
  );
  console.log(JSON.stringify(result, null, 2));
}

async function cmdTransfer(args: string[], opts: ServerOptions): Promise<void> {
  const id = flagValue(args, "--id");
  const agent = flagValue(args, "--agent");
  const ns = flagValue(args, "--ns");
  const by = flagValue(args, "--by");
  if (!id || !agent || !ns || !by) {
    console.error("Usage: amh transfer --id <memory_id> --agent <id> --ns <namespace> --by <agent>");
    process.exit(1);
  }

  const ctx = await createAmhContext(opts);
  const governance = resolveGovernance(ctx.config);
  const result = await transferMemory(
    {
      memory_id: id,
      target_namespace: ns,
      target_agent: agent,
      transferred_by: by,
    },
    ctx.store,
    {
      dedup: governance.dedup,
      antiOuroboros: governance.antiOuroboros,
      namespaceIsolation: governance.namespaceIsolation,
      writeGate: governance.writeGate,
    },
    { callerNamespace: opts.callerNamespace ?? ctx.callerNamespace }
  );
  console.log(JSON.stringify(result, null, 2));
}

async function cmdTierUpgrade(args: string[], opts: ServerOptions): Promise<void> {
  const id = flagValue(args, "--id");
  const tier = flagValue(args, "--tier") as "llm_derived" | "human_confirmed" | undefined;
  const by = flagValue(args, "--by");
  const method = (flagValue(args, "--method") ?? "human_review") as "human_review" | "peer_consensus" | "automated_check" | "cross_reference";
  if (!id || !tier || !by) {
    console.error("Usage: amh tier-upgrade --id <memory_id> --tier <llm_derived|human_confirmed> --by <agent> [--method <method>]");
    process.exit(1);
  }

  const ctx = await createAmhContext(opts);
  const identity = resolveIdentityConfig(ctx.config);
  const result = await tierUpgrade(
    id,
    tier,
    {
      tier,
      confirmed_by: by,
      confirmed_at: new Date().toISOString(),
      evidence_ids: [],
      method,
    },
    ctx.store,
    { callerNamespace: opts.callerNamespace ?? ctx.callerNamespace },
    {
      enabled: identity.enabled,
      enforceHumanTier: identity.enforceHumanTier,
      identityStore: ctx.identityStore,
    },
  );
  console.log(JSON.stringify(result, null, 2));
}

async function cmdPrincipal(args: string[], opts: ServerOptions): Promise<void> {
  const subcommand = args[0];
  const ctx = await createAmhContext(opts);
  const identityStore = requireIdentityStore(ctx);

  if (subcommand === "register") {
    const id = flagValue(args, "--id");
    const type = flagValue(args, "--type") as PrincipalType | undefined;
    const name = flagValue(args, "--name");
    if (!id || !type || !["human", "agent", "system"].includes(type)) {
      console.error("Usage: amh principal register --id <id> --type <human|agent|system> [--name <display>]");
      process.exit(1);
    }

    const result = await registerPrincipal(id, type, name, identityStore);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (subcommand === "list") {
    if ("listPrincipals" in identityStore && typeof identityStore.listPrincipals === "function") {
      console.log(JSON.stringify(await identityStore.listPrincipals(), null, 2));
      return;
    }
    console.log(JSON.stringify([], null, 2));
    return;
  }

  console.error("Usage: amh principal <register|list>");
  process.exit(1);
}

async function cmdAudit(args: string[], opts: ServerOptions): Promise<void> {
  const id = flagValue(args, "--id");
  if (!id) {
    console.error("Usage: amh audit --id <memory_id>");
    process.exit(1);
  }
  const ctx = await createAmhContext(opts);
  const governance = resolveGovernance(ctx.config);
  const record = await readMemory(id, ctx.store, {
    callerNamespace: opts.callerNamespace ?? ctx.callerNamespace,
    namespaceIsolation: governance.namespaceIsolation,
    filterInactive: false,
  });
  if (!record) {
    console.log(JSON.stringify([], null, 2));
    return;
  }
  const events = await getAuditLog(id, ctx.store);
  console.log(JSON.stringify(events, null, 2));
}

async function cmdMigrate(args: string[], opts: ServerOptions): Promise<void> {
  const ctx = await createAmhContext(opts);
  const store = ctx.store;

  if (!("db" in store) || typeof (store as any).db?.prepare !== "function") {
    console.error("amh migrate currently supports SQLite only. For Postgres, run the equivalent SQL manually:");
    console.error("  UPDATE memories SET memory_type = 'fact' WHERE memory_type = 'decision';");
    process.exit(1);
  }

  const db = (store as any).db;
  const { computeContentHash } = await import("./governance/dedup.js");
  const migrations: string[] = [];

  const txn = db.transaction(() => {
    const result = db.prepare("UPDATE memories SET memory_type = 'fact' WHERE memory_type = 'decision'").run();
    if (result.changes > 0) {
      migrations.push(`decision→fact: ${result.changes} records`);
    }

    const update = db.prepare("UPDATE memories SET content_hash = ? WHERE memory_id = ?");
    let rehashed = 0;
    for (const row of db.prepare("SELECT memory_id, content_format, content_value, content_hash FROM memories").iterate()) {
      const correct = computeContentHash((row as any).content_format, (row as any).content_value);
      if ((row as any).content_hash !== correct) {
        update.run(correct, (row as any).memory_id);
        rehashed++;
      }
    }
    if (rehashed > 0) {
      migrations.push(`content_hash rehash: ${rehashed} records`);
    }
  });

  txn();

  if (migrations.length === 0) {
    console.log(JSON.stringify({ status: "up_to_date", migrations: [] }, null, 2));
  } else {
    console.log(JSON.stringify({ status: "migrated", migrations }, null, 2));
  }
}

async function cmdStatus(opts: ServerOptions): Promise<void> {
  const ctx = await createAmhContext(opts);
  const governance = resolveGovernance(ctx.config);
  const recordCount = await ctx.store.count();
  const ns = await ctx.store.namespaces();
  console.log(
    JSON.stringify(
      {
        version: AMH_VERSION,
        records: recordCount,
        namespaces: ns,
        caller_namespace: opts.callerNamespace ?? ctx.callerNamespace ?? null,
        governance,
      },
      null,
      2
    )
  );
}

const rawArgs = process.argv.slice(2);
const { command, rest, opts } = parseGlobalOpts(rawArgs);

if (command === "--help" || command === "-h" || rawArgs.includes("--help") || rawArgs.includes("-h")) {
  printHelp();
} else if (command === "--version" || command === "-v" || rawArgs.includes("--version") || rawArgs.includes("-v")) {
  console.log(AMH_VERSION);
} else if (command === "serve" || command.startsWith("--")) {
  startServer(opts).catch((err) => {
    console.error("AMH server error:", err);
    process.exit(1);
  });
} else if (command === "write") {
  cmdWrite(rest, opts).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (command === "read") {
  cmdRead(rest, opts).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (command === "import") {
  cmdImport(rest, opts).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (command === "export") {
  cmdExport(rest, opts).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (command === "forget") {
  cmdForget(rest, opts).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (command === "expire") {
  cmdExpire(rest, opts).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (command === "transfer") {
  cmdTransfer(rest, opts).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (command === "tier-upgrade") {
  cmdTierUpgrade(rest, opts).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (command === "principal") {
  cmdPrincipal(rest, opts).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (command === "audit") {
  cmdAudit(rest, opts).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (command === "migrate") {
  cmdMigrate(rest, opts).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (command === "status") {
  cmdStatus(opts).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  console.error(`Unknown command: ${command}. Run 'amh --help' for usage.`);
  process.exit(1);
}
