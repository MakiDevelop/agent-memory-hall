#!/usr/bin/env node

import { startServer, type ServerOptions } from "./mcp/server.js";
import { createAmhContext } from "./mcp/server.js";
import { AMH_VERSION } from "./version.js";
import { writeMemory } from "./operations/write.js";
import { queryMemories, readMemory } from "./operations/read.js";
import { getAuditLog } from "./operations/audit.js";
import { importUmpFile } from "./import/ump.js";
import { importMem0File } from "./import/mem0.js";
import { resolveGovernance } from "./config.js";

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

function printHelp(): void {
  console.log(`Agent Memory Hall (AMH) v${AMH_VERSION}

Usage:
  amh [serve]                  Start MCP server (SQLite default)
  amh write [options] <content>
  amh read [options]
  amh import --from <ump|mem0> <file>
  amh audit --id <memory_id>
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
  --type <type>        decision|fact|preference|constraint|lesson|risk
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
  amh write --agent planner --ns project:acme --type decision "Use PostgreSQL"
  amh read --ns project:acme --type decision
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

async function cmdWrite(args: string[], opts: ServerOptions): Promise<void> {
  const agent = flagValue(args, "--agent");
  const ns = flagValue(args, "--ns");
  const type = flagValue(args, "--type") as Parameters<typeof writeMemory>[0]["memory_type"] | undefined;
  const tier = flagValue(args, "--tier") as Parameters<typeof writeMemory>[0]["source_tier"] | undefined;
  const sourceRef = flagValue(args, "--source-ref") ?? "";
  const contentParts = args.filter((a) => !a.startsWith("--") && a !== agent && a !== ns && a !== type && a !== tier && a !== sourceRef);
  const content = contentParts.join(" ").trim();

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
      caller_namespace: opts.callerNamespace ?? ctx.callerNamespace,
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
    console.log(record ? JSON.stringify(record, null, 2) : "Not found");
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
          caller_namespace: opts.callerNamespace ?? ctx.callerNamespace ?? record.namespace,
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

async function cmdAudit(args: string[], opts: ServerOptions): Promise<void> {
  const id = flagValue(args, "--id");
  if (!id) {
    console.error("Usage: amh audit --id <memory_id>");
    process.exit(1);
  }
  const ctx = await createAmhContext(opts);
  const events = await getAuditLog(id, ctx.store);
  console.log(JSON.stringify(events, null, 2));
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
} else if (command === "audit") {
  cmdAudit(rest, opts).catch((err) => {
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