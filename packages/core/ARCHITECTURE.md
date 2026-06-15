# @agent-memory-hall/core — Architecture

## Overview

MCP-native memory server with built-in governance. One command to start:

```bash
npx agent-memory-hall
```

## Module Structure

```
src/
├── schema/
│   ├── types.ts          # AMH record type definitions
│   └── validate.ts       # JSON Schema validation
├── operations/
│   ├── write.ts          # Create/update memory records
│   ├── read.ts           # Query by ID, namespace, type, agent
│   ├── transfer.ts       # Cross-agent memory transfer with provenance chain
│   └── audit.ts          # Append-only event log
├── governance/
│   ├── source-tier.ts    # raw_source / llm_derived / human_confirmed
│   ├── write-gate.ts     # Configurable pre-write checks
│   ├── dedup.ts          # content_hash deduplication
│   └── namespace.ts      # Namespace isolation enforcement
├── store/
│   ├── interface.ts      # Store adapter interface
│   ├── json-file.ts      # Default: ~/.amh/memory.json
│   └── sqlite.ts         # SQLite adapter (optional)
├── mcp/
│   ├── server.ts         # MCP server (amh.write / amh.read / amh.transfer / amh.audit)
│   └── resources.ts      # MCP resource exposure (amh://{namespace}/{id})
├── import/
│   ├── ump.ts            # Import from UMP format (*.ump.json)
│   └── mem0.ts           # Import from Mem0 export
└── index.ts              # Public API
```

## AMH Record Schema (v0.1)

```typescript
interface AmhRecord {
  amh_version: "0.1";
  memory_id: string;
  version: number;
  status: "active" | "superseded" | "revoked" | "expired";
  agent_id: string;
  namespace: string;
  memory_type: "decision" | "fact" | "preference" | "constraint" | "lesson" | "risk";
  content: {
    format: string;  // MIME type
    value: string;
  };
  source: {
    type: "human" | "agent" | "system" | "document";
    ref: string;
    tier: "raw_source" | "llm_derived" | "human_confirmed";
  };
  created_at: string;  // ISO 8601
  created_by: string;
  // v0.1 additions from UMP lessons
  valid_until?: string;   // ISO 8601 — when this fact stops being true
  supersedes?: string;    // memory_id of record this replaces
  content_hash?: string;  // BLAKE3 for dedup
}
```

## Governance Layer (the differentiator)

### source_tier
Every memory has a trust level:
- `raw_source` — direct observation or raw data
- `llm_derived` — LLM generated/summarized
- `human_confirmed` — human verified

Rule: `llm_derived` memories cannot be fed back into consolidation (anti-Ouroboros).

### write-gate
Configurable checks before any write:
- Dedup check (content_hash)
- Namespace permission check
- Source tier validation
- Optional custom gates (user-defined)

### namespace isolation
Memories in different namespaces are isolated by default.
Cross-namespace reads require explicit permission.

## MCP Tools

| Tool | Description |
|------|-------------|
| `amh_write` | Write a memory record. Returns memory_id + version. |
| `amh_read` | Query memories by ID, namespace, type, agent, or text search. |
| `amh_transfer` | Transfer memory to another namespace/agent with provenance. |
| `amh_audit` | Get append-only event log for a memory record. |
| `amh_status` | Server status: record count, namespaces, store info. |

## MCP Resources

Memories exposed as MCP resources at `amh://{namespace}/{memory_id}`.
Browsable by namespace.

## Configuration

```json
// ~/.amh/config.json
{
  "store": "json-file",
  "store_path": "~/.amh/memory.json",
  "governance": {
    "dedup": true,
    "anti_ouroboros": true,
    "namespace_isolation": true,
    "write_gate": true
  }
}
```

## CLI

```bash
amh write --type decision --agent planner --ns project:acme "Use PostgreSQL"
amh read --ns project:acme --type decision
amh import --from ump ./memory.ump.json
amh import --from mem0 ./mem0-export.json
amh status
amh serve  # Start MCP server
```
