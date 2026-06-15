# Agent Memory Hall

> An open interchange protocol for portable, governable, and auditable memory across AI agents.

## The Problem

AI agents can call tools (MCP), talk to each other (A2A), and be authorized (Agent Identity). But there is no standard for how agents **remember**.

Every agent framework invents its own memory — Mem0, Zep, Letta, LangChain Memory, custom vector stores. None of them can talk to each other. When you switch frameworks, your agent's memory starts from zero.

## What AMH Is — and What It Is Not

**AMH is an interchange and audit protocol.** It defines how memory records are represented, transferred, expired, and audited across agents, tools, teams, and runtimes.

AMH does **not** replace your vector database, decide what to remember, or specify embedding formats. Think of it this way: MCP doesn't tell you which tools to build. AMH doesn't tell you what to remember. It tells you how to **write it down so others can read it**.

## Core Schema (v0.1 — minimal)

```json
{
  "amh_version": "0.1",
  "memory_id": "mem_001",
  "version": 1,
  "status": "active",
  "agent_id": "planner-agent",
  "namespace": "project:acme",
  "memory_type": "decision",
  "content": {
    "format": "text/plain",
    "value": "Use PostgreSQL for the user store. Rationale: team expertise + JSONB flexibility."
  },
  "source": {
    "type": "agent",
    "ref": "session:2026-06-15-arch-review",
    "tier": "llm_derived"
  },
  "created_at": "2026-06-15T09:30:00Z",
  "created_by": "planner-agent"
}
```

## Quick Start

```bash
# Start AMH as an MCP server (Claude Desktop / Cursor / Codex)
npx @chibakuma/agent-memory-hall

# CLI examples
npx @chibakuma/agent-memory-hall write --agent planner --ns project:acme --type decision "Use PostgreSQL"
npx @chibakuma/agent-memory-hall read --ns project:acme
npx @chibakuma/agent-memory-hall import --from ump ./memory.ump.json
npx @chibakuma/agent-memory-hall status
```

Add to your MCP client config:

```json
{
  "mcpServers": {
    "agent-memory-hall": {
      "command": "npx",
      "args": ["@chibakuma/agent-memory-hall"]
    }
  }
}
```

### Configuration (`~/.amh/config.json`)

```json
{
  "store": "sqlite",
  "store_path": "~/.amh/memory.db",
  "caller_namespace": "project:acme",
  "governance": {
    "dedup": true,
    "anti_ouroboros": true,
    "namespace_isolation": true,
    "write_gate": true
  }
}
```

### Multi-agent (Docker + PostgreSQL)

```bash
docker compose up -d
npx @chibakuma/agent-memory-hall --store postgres --path postgres://amh:amh@localhost:5432/amh
```

## Built-in Governance

| Feature | What it does |
|---------|-------------|
| **source_tier** | `raw_source` / `llm_derived` / `human_confirmed` — anti-Ouroboros |
| **write-gate** | Pre-write checks: dedup, namespace, source tier |
| **content_hash dedup** | BLAKE3 hash; rejects duplicate active content per namespace |
| **namespace isolation** | Scoped read/write when `caller_namespace` is set |
| **lifecycle** | `valid_until` records filtered on read by default |

## MCP Tools & Resources

| Tool | Description |
|------|-------------|
| `amh_write` | Write with governance; returns `governance_applied` |
| `amh_read` | Query by ID/filters; expired records filtered by default |
| `amh_transfer` | Reassign memory to another agent in caller namespace (provenance preserved; cross-namespace blocked when isolation on) |
| `amh_audit` | Append-only event log |
| `amh_status` | Version, counts, governance config |

Resources: `amh://{namespace}/{memory_id}`

## Codex Handoff

See [packages/core/docs/codex-handoff.md](packages/core/docs/codex-handoff.md) for local CLI dogfooding (no memhall HTTP / no bearer token).

## Status

**v0.5.1 — Reference Implementation (dogfooding)**

- npm: `@chibakuma/agent-memory-hall`
- Stores: SQLite (default) / PostgreSQL / JSON / memhall
- Import: UMP, Mem0
- CI: typecheck + unit tests

## Positioning

> **UMP defines the wire. AMH ships the governance.**

## Related Efforts

- **UMP** — transport-neutral wire format; AMH imports/exports UMP records
- **W3C AI Agent Memory Interoperability CG** — encryption, identity, audit anchors
- **Letta Context Repositories** — git-based memory for coding agents
- **Mem0 / Zep / Cognee** — framework stores; AMH adds governance on top

## License

Apache 2.0