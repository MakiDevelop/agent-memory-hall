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

## Status

**Phase: Whitepaper + Reference Implementation** (Month 1-2 of 6)

See [`docs/whitepaper-outline.md`](docs/whitepaper-outline.md) for the working outline.

## Roadmap

| Month | Deliverable |
|-------|------------|
| 1-2 | Whitepaper (5 chapters) + minimal spec + reference implementation (`amh-python`) |
| 3 | MCP integration (AMH memories as MCP resources) |
| 4 | Adapters: import/export for Mem0, Zep, Letta, LangChain Memory |
| 5 | Case study: *How a multi-agent dev team avoids collective amnesia* |
| 6 | Public spec release + open source |

## Related Efforts

- **W3C AI Agent Memory Interoperability CG** (est. 2026-06-03) — focuses on encryption envelopes, post-quantum identity binding, audit anchors. Complementary to AMH's semantic format + interchange layer.
- **Letta Context Repositories** — git-based memory for coding agents. Validates the markdown + YAML frontmatter + git approach; AMH aims to make this portable across frameworks.
- **UMP, OAMP, and other specs** — multiple early-stage efforts exist. None have achieved community convergence. AMH differentiates by shipping a reference implementation alongside the spec.

## License

Apache 2.0
