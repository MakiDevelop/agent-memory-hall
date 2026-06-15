# Agent Memory Hall

> An open protocol for portable, governable, and auditable memory across AI agents.
> **Reference implementation of [Agent Civilization Architecture](https://github.com/MakiDevelop/agent-civilization-architecture) (ACA) Layers 1-3.**

**npm:** `@chibakuma/agent-memory-hall` · **Repository:** [github.com/MakiDevelop/agent-memory-hall](https://github.com/MakiDevelop/agent-memory-hall)

## The Problem

AI agents can call tools (MCP), talk to each other (A2A), and prove identity (W3C DID). But there is no standard for how agents **remember**, **trust**, or **govern** their collective knowledge.

Every agent framework invents its own memory — Mem0, Zep, Letta, LangChain Memory, custom vector stores. None of them can talk to each other. When you switch frameworks, your agent's memory starts from zero. When agents share memory, there's no governance over who can write what, whether to trust it, or how to audit it.

## What AMH Does

AMH is a **memory governance protocol** with a reference implementation. It defines:

- **How memory is stored** — MemoryCells with typed content, source provenance, and lifecycle management
- **How trust propagates** — Three-tier trust system (`raw_source` → `llm_derived` → `human_confirmed`) with the Anti-Ouroboros Rule preventing LLM self-reinforcement
- **How identity controls access** — Principal registry, namespace ACL, and human-in-the-loop enforcement
- **How everything is audited** — Append-only audit log, provenance chains, trust proofs

## Quick Start

```bash
# Start AMH as an MCP server (Claude Desktop / Cursor / Codex)
npx @chibakuma/agent-memory-hall

# Write a memory
npx @chibakuma/agent-memory-hall write --agent planner --ns project:acme --type fact "Use PostgreSQL for the user store"

# Read memories
npx @chibakuma/agent-memory-hall read --ns project:acme

# Upgrade trust tier
npx @chibakuma/agent-memory-hall tier-upgrade --id <memory_id> --tier human_confirmed --by human:reviewer

# Check status
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

## Core Schema

```json
{
  "amh_version": "0.1",
  "memory_id": "mem_001",
  "status": "active",
  "agent_id": "planner-agent",
  "namespace": "project:acme",
  "memory_type": "fact",
  "content": {
    "format": "text/plain",
    "value": "Use PostgreSQL for the user store. Rationale: team expertise + JSONB flexibility."
  },
  "source": {
    "type": "agent",
    "ref": "session:2026-06-15-arch-review",
    "tier": "llm_derived"
  },
  "content_hash": "a0b4f4a4...",
  "created_at": "2026-06-15T09:30:00Z",
  "created_by": "planner-agent",
  "trust_proof": null,
  "provenance_chain": null
}
```

**Memory types:** `fact` · `preference` · `constraint` · `lesson` · `risk`

**Source tiers:** `raw_source` (unverified) · `llm_derived` (AI-generated) · `human_confirmed` (human-reviewed)

## Built-in Governance (ACA Layer 1+2)

| Feature | What it does |
|---------|-------------|
| **Anti-Ouroboros** | Blocks `llm_derived` superseding `llm_derived` — prevents LLM belief amplification loops |
| **Content-hash dedup** | BLAKE3 hash of `format:value`; rejects duplicate active content per namespace |
| **Namespace isolation** | Scoped read/write; cross-namespace blocked unless explicitly granted |
| **Lifecycle filter** | Expired/revoked/superseded records hidden from default reads |
| **Tier upgrade** | Monotonic trust upgrade with TrustProof attestation |
| **Provenance chain** | Append-only lineage tracking across transfers, supersedes, and tier upgrades |
| **Trust proof** | Structured evidence for tier transitions (who confirmed, when, method, evidence) |

## Identity (ACA Layer 3) — Optional

```bash
# Register principals
npx @chibakuma/agent-memory-hall principal register --id human:maki --type human --name "Maki"
npx @chibakuma/agent-memory-hall principal register --id agent:planner --type agent

# Human enforcement: only human principals can confirm human_confirmed tier
```

When identity is enabled, `tier_upgrade` to `human_confirmed` verifies that `confirmed_by` is a registered human principal — protocol-level human-in-the-loop enforcement.

## MCP Tools

| Tool | Description |
|------|-------------|
| `amh_write` | Write with governance; returns `governance_applied` |
| `amh_read` | Query by ID/filters; expired records filtered by default |
| `amh_tier_upgrade` | Upgrade source tier with trust proof |
| `amh_transfer` | Copy memory to another namespace (provenance preserved) |
| `amh_forget` | Revoke memory (soft delete); audit preserved |
| `amh_expire` | Explicitly expire a memory |
| `amh_audit` | Append-only event log |
| `amh_register_principal` | Register a principal (Layer 3) |
| `amh_authorize` | Check principal's namespace permissions (Layer 3) |
| `amh_status` | Version, counts, governance config |

Resources: `amh://{namespace}/{memory_id}`

## CLI Commands

```
amh [serve]              Start MCP server (SQLite default)
amh write                Write a memory
amh read                 Query memories
amh tier-upgrade         Upgrade source tier
amh transfer             Copy to another namespace
amh forget               Revoke (soft delete)
amh expire               Explicitly expire
amh audit                View audit log
amh principal register   Register a principal (Layer 3)
amh principal list       List principals
amh migrate              Run DB migrations (decision→fact, content_hash rehash)
amh import               Import from UMP or Mem0
amh export               Export to UMP
amh status               Server status
```

## Store Backends

| Store | Use case |
|-------|----------|
| **SQLite** (default) | Single agent, local development, `~/.amh/memory.db` |
| **PostgreSQL** | Multi-agent, production, Docker deployment |
| **JSON** | Codex sandbox, single-repo isolation |
| **memhall** | HTTP adapter for memory-hall server |

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
  },
  "identity": {
    "enabled": false,
    "enforce_human_tier": true
  }
}
```

### Multi-agent (Docker + PostgreSQL)

```bash
docker compose up -d
npx @chibakuma/agent-memory-hall --store postgres --path postgres://amh:amh@localhost:5432/amh
```

## Agent Civilization Architecture (ACA)

AMH is the reference implementation of [ACA](https://github.com/MakiDevelop/agent-civilization-architecture), an open protocol for how AI organizations govern their collective knowledge, trust, and decisions.

| ACA Layer | Purpose | AMH Coverage |
|---|---|---|
| **Layer 1: Memory** | What does the organization remember? | Full (8 operations + governance gates) |
| **Layer 2: Trust** | What does the organization believe? | Full (Anti-Ouroboros + tier transitions + provenance) |
| **Layer 3: Identity** | Who belongs? Who can act? | Full (principals + auth + ACL + human enforcement) |
| Layer 4: Authority | Who has the right to decide? | Spec complete; implementation planned |
| Layer 5: Decision | How does the organization decide? | Spec complete; implementation planned |

## Status

**v0.8.0 — ACA Layer 1-3 Conformant**

- 71 tests passing
- npm: `@chibakuma/agent-memory-hall`
- Stores: SQLite (default) / PostgreSQL / JSON / memhall
- Import: UMP, Mem0

## Related Efforts

- **[ACA](https://github.com/MakiDevelop/agent-civilization-architecture)** — the protocol spec that AMH implements
- **UMP** — transport-neutral wire format; AMH imports/exports UMP records
- **W3C AI Agent Memory Interoperability CG** — encryption, identity, audit anchors
- **Letta Context Repositories** — git-based memory for coding agents
- **Mem0 / Zep / Cognee** — framework stores; AMH adds governance on top

## License

Apache 2.0 — see [LICENSE](https://github.com/MakiDevelop/agent-memory-hall/blob/main/LICENSE)
