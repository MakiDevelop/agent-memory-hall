#!/usr/bin/env node

import { startServer, type ServerOptions } from "./mcp/server.js";

const args = process.argv.slice(2);
const command = args[0];

function parseOpts(): ServerOptions {
  const opts: ServerOptions = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--store" && args[i + 1]) {
      opts.storeType = args[i + 1] as "json" | "sqlite" | "postgres" | "memhall";
      i++;
    } else if (args[i] === "--token" && args[i + 1]) {
      opts.memhallToken = args[i + 1];
      i++;
    } else if (args[i] === "--path" && args[i + 1]) {
      opts.storePath = args[i + 1];
      i++;
    }
  }
  return opts;
}

if (!command || command === "serve" || command.startsWith("--")) {
  const opts = parseOpts();
  startServer(opts).catch((err) => {
    console.error("AMH server error:", err);
    process.exit(1);
  });
} else if (command === "--help" || command === "-h") {
  console.log(`Agent Memory Hall (AMH) v0.2.0

Usage:
  amh                         Start MCP server (SQLite, default)
  amh serve                   Same as above
  amh --store sqlite          Use SQLite store (default, single agent)
  amh --store json            Use JSON file store
  amh --store postgres        Use PostgreSQL (multi-agent recommended)
  amh --store memhall         Use existing memhall instance as backend
  amh --path <path|url>       Store file path or connection string
  amh --token <token>         Auth token (for memhall store)
  amh --help                  Show this help

Examples:
  amh                                          SQLite at ~/.amh/memory.db
  amh --store postgres --path postgres://user:pass@localhost:5432/amh

MCP Config (add to your client):
  {
    "mcpServers": {
      "agent-memory-hall": {
        "command": "npx",
        "args": ["@chibakuma/agent-memory-hall"]
      }
    }
  }

Multi-agent with Docker + Postgres:
  docker compose up -d    (see docker-compose.yml in repo)
`);
} else {
  console.error(`Unknown command: ${command}. Run 'amh --help' for usage.`);
  process.exit(1);
}
