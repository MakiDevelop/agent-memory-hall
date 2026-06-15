# Agent Memory Hall

> An open interchange protocol for portable, governable, and auditable memory across AI agents.

## The Problem

AI agents can call tools (MCP), talk to each other (A2A), and be authorized (Agent Identity). But there is no standard for how agents **remember**.

Every agent framework invents its own memory — Mem0, Zep, Letta, LangChain Memory, custom vector stores. None of them can talk to each other. When you switch frameworks, your agent's memory starts from zero.

Today, most agent memory suffers from four unknowns:

- **Who wrote it?** No provenance.
- **Can it be trusted?** No verification chain.
- **When should it be forgotten?** No lifecycle.
- **Can another agent read it?** No portability.

Agent Memory Hall fills this gap.

## What AMH Is — and What It Is Not

**AMH is an interchange and audit protocol.** It defines how memory records are represented, transferred, expired, and audited across agents, tools, teams, and runtimes.

AMH does **not**:

- Replace your vector database or memory store
- Define how agents decide what to remember
- Specify embedding formats or search algorithms
- Compete with MCP, A2A, or identity protocols
- Require any specific runtime or framework

Think of it this way: MCP doesn't tell you which tools to build. AMH doesn't tell you what to remember. It tells you how to **write it down so others can read it**.

## Positioning

| Layer | Protocol | What it standardizes |
|-------|----------|---------------------|
| Tools | MCP | How agents connect to tools and data |
| Communication | A2A | How agents talk to each other |
| Identity | AIP / DID | How agents are identified and authorized |
| **Memory** | **AMH** | **How agents remember, forget, and share knowledge** |

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
    "ref": "session:2026-06-15-arch-review"
  },
  "created_at": "2026-06-15T09:30:00Z",
  "created_by": "planner-agent"
}
```

**That's it for v0.1.** Optional extensions (confidence, retention policies, visibility, full audit log) are defined separately — they are not required for a conforming implementation.

## Operations (v0.1)

| Operation | Description |
|-----------|-------------|
| `write` | Create or update a memory record |
| `read` | Retrieve by ID, filter by namespace/type/agent |
| `transfer` | Move memory between agents with provenance chain preservation |
| `audit` | Append-only event log of all operations on a record |

## Origin Story

This protocol is informed by operational experience running **memhall** — a multi-agent memory system serving a 7-agent council (Claude, Codex, Gemini, Grok, gemma4, Perplexity Max, SuperGrok) across 60+ collaborative sessions. The lessons learned from content_hash dedup, namespace isolation, concurrent write conflicts, and a full memory system migration (mem0 → memhall) directly shaped AMH's design decisions.

## Academic Foundations

AMH builds on established research:

- **Park et al. 2023** — Memory Stream + Reflection architecture (2000+ citations)
- **Hu et al. 2025** — Forms × Functions × Dynamics taxonomy (arXiv:2512.13564)
- **Jiang et al. 2026** — Four-structure empirical analysis + Context Saturation Gap (arXiv:2602.19320)
- **Metadata**: Dublin Core vocabulary + W3C Verifiable Credentials v2.0 for provenance

## Quick Start

```bash
# Start AMH as an MCP server (Claude Desktop / Cursor / Codex)
npx agent-memory-hall

# Or install globally
npm install -g @agent-memory-hall/core
amh serve
```

Add to your MCP client config:

```json
{
  "mcpServers": {
    "agent-memory-hall": {
      "command": "npx",
      "args": ["agent-memory-hall"]
    }
  }
}
```

## Built-in Governance (What Makes AMH Different)

Most memory tools store and retrieve. AMH **governs**.

| Feature | What it does | Why it matters |
|---------|-------------|----------------|
| **source_tier** | Tags every memory as `raw_source` / `llm_derived` / `human_confirmed` | Prevents the Ouroboros problem (LLM-derived memory fed back as ground truth) |
| **write-gate** | Configurable checks before any write | Blocks duplicates, enforces namespace rules, validates source |
| **content_hash dedup** | BLAKE3 hash of content, auto-rejects duplicates | Memory doesn't bloat over time |
| **namespace isolation** | Memories in different namespaces are isolated by default | Agent A can't accidentally read Agent B's private context |

These aren't optional add-ons. They're defaults. Turn them off if you want, but they're on from day one — because we learned the hard way that ungoverned memory degrades fast.

## Status

**Phase: Reference Implementation** (Week 1-2)

## Roadmap

| Week | Deliverable |
|------|------------|
| 1-2 | `@agent-memory-hall/core` — MCP server + CLI + JSON store + governance |
| 3-4 | Whitepaper v1 + UMP/Mem0 import adapters |
| 5-6 | LoCoMo benchmark (Hindsight AMB framework, public judge prompt) |
| 7-8 | SQLite store + Letta adapter + MCP resource exposure |
| 9-10 | Case study: *How a multi-agent dev team avoids collective amnesia* |
| 11-12 | Public launch: npm publish + GitHub public + blog + HN |

## Positioning

> **UMP defines the wire. AMH ships the governance.**

AMH is compatible with UMP format (import/export). You don't have to choose. But when you use AMH's MCP server, you get source_tier, write gates, dedup, and namespace isolation out of the box — features born from running a 7-agent memory system across 60+ real sessions.

## Related Efforts

- **UMP (Universal Memory Protocol)** — transport-neutral wire format with MCP binding. AMH can import/export UMP records. We focus on governance; they focus on format.
- **W3C AI Agent Memory Interoperability CG** (est. 2026-06-03) — encryption envelopes, post-quantum identity, audit anchors. Complementary to AMH's semantic + governance layer.
- **Letta Context Repositories** — git-based memory for coding agents. Validates markdown + git approach; AMH makes it portable across frameworks.
- **Mem0 / Zep / Cognee** — framework-specific memory stores. AMH provides a governance layer that can sit on top of any of them.

## License

Apache 2.0
