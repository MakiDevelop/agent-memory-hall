# @chibakuma/agent-memory-hall — Architecture

## Overview

MCP-native memory server with built-in governance.

```bash
npx @chibakuma/agent-memory-hall
```

## Module Structure

```
src/
├── schema/
│   ├── types.ts          # AMH record type definitions (Zod)
│   └── validate.ts       # Record validation helpers
├── config.ts             # ~/.amh/config.json loader
├── version.ts            # Single source version from package.json
├── operations/
│   ├── write.ts          # Create memory + governance + audit
│   ├── read.ts           # Query with namespace isolation + lifecycle filter
│   ├── transfer.ts       # Cross-agent transfer through write-gate
│   └── audit.ts          # Append-only event log
├── governance/
│   ├── source-tier.ts    # Anti-Ouroboros on supersede chains
│   ├── write-gate.ts     # Pre-write checks (wired)
│   ├── dedup.ts          # BLAKE3 content_hash dedup
│   ├── namespace.ts      # Namespace isolation (wired on read/write)
│   └── lifecycle.ts      # valid_until / expired filtering
├── store/
│   ├── interface.ts      # Store adapter interface
│   ├── factory.ts        # createStore() from config/CLI
│   ├── json-file.ts      # JSON store with file lock
│   ├── sqlite.ts         # Default: ~/.amh/memory.db
│   ├── postgres.ts       # Multi-agent shared store
│   └── memhall.ts        # memhall API adapter
├── mcp/
│   ├── server.ts         # MCP tools
│   └── resources.ts      # amh://{namespace}/{memory_id}
├── import/
│   ├── ump.ts            # UMP import/export
│   └── mem0.ts           # Mem0 import
└── cli.ts                # serve | write | read | import | audit | status
```

## Governance Layer

### source_tier + anti-Ouroboros
`llm_derived` cannot supersede another `llm_derived` memory.

### write-gate (default on)
- Namespace isolation when `caller_namespace` set
- Anti-Ouroboros check
- BLAKE3 `content_hash`
- Per-namespace dedup via indexed hash lookup

### lifecycle
Read paths filter records past `valid_until` unless `include_expired=true`.

## Configuration

`~/.amh/config.json` — see root README.

CLI override: `--caller-ns project:acme`

## CLI

```bash
amh write --agent planner --ns project:acme --type decision "Use PostgreSQL"
amh read --ns project:acme --type decision
amh import --from ump ./memory.ump.json
amh audit --id <memory_id>
amh status
amh serve
```