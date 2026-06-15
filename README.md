# AMP — Agent Memory Protocol

> An open protocol for portable, governable, and auditable memory across AI agents.

## The Gap

AI agents can now call tools (MCP), talk to each other (A2A), and be authorized (Agent Identity). But there is no standard for how agents **remember** — how memory is written, read, transferred, expired, and audited across systems.

Today, most agent memory suffers from four unknowns:

- **Who wrote it?** No provenance.
- **Can it be trusted?** No confidence or verification.
- **When should it be forgotten?** No lifecycle.
- **Can it be shared?** No portability.

AMP fills this gap.

## Positioning

| Layer | Protocol | What it standardizes |
|-------|----------|---------------------|
| Tools | MCP | How agents connect to tools and data |
| Communication | A2A | How agents talk to each other |
| Identity | AIP / DID | How agents are identified and authorized |
| **Memory** | **AMP** | **How agents remember, forget, and share knowledge** |

## Core Principles

1. **Memory is not RAG.** Retrieval-augmented generation fetches documents. Memory is what an agent *knows* — decisions, preferences, constraints, lessons, risks.
2. **Memory needs a lifecycle.** Session-scoped, project-scoped, permanent, or expiring. Not everything should live forever.
3. **Memory needs provenance.** Every memory entry must trace back to its source — human, agent, system, or document.
4. **Memory needs governance.** Visibility, retention, audit trails. Who can read it, who can modify it, and why.
5. **Memory must be portable.** If Agent A learns something, Agent B should be able to receive it through a standard interface — not a proprietary API.

## Status

**Phase: Whitepaper** (Month 1 of 6)

See [`docs/whitepaper-outline.md`](docs/whitepaper-outline.md) for the working outline.

## Roadmap

| Month | Deliverable |
|-------|------------|
| 1 | Whitepaper: *Agent Memory Protocol: Toward Portable and Governable Memory for AI Agents* |
| 2 | Minimal spec: core schema + `write` / `read` / `transfer` / `audit` |
| 3 | Reference implementation (`amp-python`) |
| 4 | MCP / A2A integration layer |
| 5 | Case study: *How a multi-agent dev team avoids collective amnesia* |
| 6 | Public spec release + open source |

## License

Apache 2.0
