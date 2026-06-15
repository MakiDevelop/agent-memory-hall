# Agent Memory Protocol: Toward Portable and Governable Memory for AI Agents

**Working Outline — v0.1**

---

## Abstract

A 200-word summary: the problem (agent memory is siloed, ungoverned, non-portable), the proposal (AMP as an interchange layer), and why now (MCP/A2A have standardized tools and communication — memory is the missing piece).

---

## 1. Introduction: The Amnesiac Agent Problem

- Agents today are stateless by default; memory is an afterthought bolted on per-framework.
- The cost of collective amnesia in multi-agent systems: duplicated work, contradictory decisions, lost context across sessions.
- Real-world example: a planning agent makes an architectural decision, an implementing agent doesn't know about it, a reviewer re-discovers the constraint from scratch.

## 2. Agent Memory Is Not RAG

- RAG retrieves documents. Memory is what an agent *knows*.
- Key distinction: RAG is read-from-corpus. Memory is write-read-expire-transfer across agents and sessions.
- Six memory types and why the taxonomy matters:
  - **decision** — a choice that was made, with rationale
  - **fact** — a verified piece of information
  - **preference** — a user or system preference
  - **constraint** — a boundary that must not be violated
  - **lesson** — something learned from failure or success
  - **risk** — a known danger or uncertainty

## 3. Memory Needs a Lifecycle

- Session memory vs. project memory vs. permanent memory — not everything should persist.
- The "forgetting problem": unbounded memory accumulation degrades retrieval quality and increases hallucination risk.
- Retention policies: `session`, `project`, `permanent`, `expires_at`.
- Case study: memhall's content_hash dedup and namespace isolation as a practical lifecycle implementation.

## 4. Memory Needs Provenance

- Who created this memory? Human, agent, system, or document?
- The trust chain: a memory written by a human-approved agent decision is more trustworthy than one inferred by a sub-agent.
- Confidence scoring: not all memories are equally reliable.
- Source tracking: every memory entry must link back to its origin.

## 5. Memory Needs Governance

- Visibility levels: `private` (single agent), `team` (agent group), `org` (organization), `public`.
- Audit trails: created_by, modified_by, reason for modification.
- The "who can forget" problem: deletion is a governance action, not a cleanup task.
- Access control: read vs. write vs. transfer vs. delete permissions.
- Compliance considerations: GDPR right-to-forget applied to agent memory.

## 6. Multi-Agent Memory Exchange

- The portability problem: Agent A's memory is useless to Agent B without a common schema.
- Transfer semantics: what happens when memory moves between agents?
  - Provenance chain preservation
  - Confidence decay on transfer
  - Visibility scope changes
- The "collective intelligence" upside: shared memory as emergent organizational knowledge.

## 7. AMP Core Specification (Preview)

- Memory object schema (minimal v1):
  - `memory_id`, `agent_id`, `subject`, `memory_type`, `content`
  - `source` (type + ref), `confidence`, `visibility`, `retention`
  - `audit` (created_at, created_by, modified_by, reason)
- Four core operations: `write`, `read`, `transfer`, `audit`
- Relationship to existing protocols:
  - MCP: AMP memories can be exposed as MCP resources
  - A2A: memory transfer can ride A2A message channels
  - Identity: agent_id ties to existing identity frameworks

## 8. Related Work

- Framework-level memory: Mem0, Zep, Letta, Cognee, LangChain Memory — what they do and why AMP is a different layer.
- Academic: memory forms/functions/dynamics taxonomy from recent survey papers.
- Standards bodies: NIST AI agent standards, W3C, Linux Foundation — where memory fits in the broader standardization landscape.

## 9. Conclusion and Call to Action

- AMP is not a product. It is a minimal interchange specification.
- The goal: any agent framework can implement AMP-compatible memory in a weekend.
- Next steps: reference implementation, community feedback, integration with MCP/A2A ecosystems.

---

## Appendix A: Full Schema Reference

(To be developed in Month 2)

## Appendix B: Comparison Matrix

| Capability | Mem0 | Zep | Letta | Cognee | LangChain | **AMP** |
|-----------|------|-----|-------|--------|-----------|---------|
| Provenance tracking | | | | | | |
| Lifecycle management | | | | | | |
| Multi-agent transfer | | | | | | |
| Audit trail | | | | | | |
| Open spec | | | | | | |
| Framework-agnostic | | | | | | |

(To be filled during research phase)
