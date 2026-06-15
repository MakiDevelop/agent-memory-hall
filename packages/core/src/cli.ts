#!/usr/bin/env node

import { startServer } from "./mcp/server.js";

const command = process.argv[2];

if (!command || command === "serve") {
  const storePath = process.argv[3];
  startServer(storePath).catch((err) => {
    console.error("AMH server error:", err);
    process.exit(1);
  });
} else if (command === "--help" || command === "-h") {
  console.log(`Agent Memory Hall (AMH) v0.1.0

Usage:
  amh                Start MCP server (default)
  amh serve [path]   Start MCP server with custom store path
  amh --help         Show this help

MCP Config (add to your client):
  {
    "mcpServers": {
      "agent-memory-hall": {
        "command": "npx",
        "args": ["agent-memory-hall"]
      }
    }
  }
`);
} else {
  console.error(`Unknown command: ${command}. Run 'amh --help' for usage.`);
  process.exit(1);
}
