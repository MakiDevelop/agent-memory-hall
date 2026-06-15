# Agent Memory Hall: Toward Portable and Governable Memory for AI Agents

**Working Outline — v0.2 (post-council review)**

---

## Abstract

200 words. The problem: agent memory is siloed, ungoverned, non-portable. The proposal: AMH as a minimal interchange protocol — not a memory store, not a cognitive model, just the wire format and operations for memory records to move between agents. Why now: MCP standardized tools, A2A standardized communication — memory is the missing layer, and the window for a clean standard is closing as de facto solutions ossify.

---

## 1. The Problem: Amnesiac Agents in a Multi-Agent World

**Merges original Ch 1 + Ch 2.**

- Agents are stateless by default. Memory is an afterthought bolted on per-framework.
- The cost of collective amnesia: duplicated work, contradictory decisions, lost context across sessions and agent boundaries.
- Concrete example: a planning agent decides on PostgreSQL, an implementing agent doesn't know, a reviewer re-discovers the constraint from scratch.

### Memory Is Not RAG

- RAG retrieves documents from a corpus. Memory records what an agent *knows* from experience.
- RAG is Library; Memory is Biography.
- Key distinction: RAG is read-from-corpus. Memory is write-read-expire-transfer across agents and sessions.
- The "RAG with metadata" counterargument and why it fails: memory involves synthesis, identity coupling, and lifecycle — not just retrieval with extra fields.

---

## 2. What a Memory Interchange Protocol Must Guarantee

**Merges original Ch 3 (Lifecycle) + Ch 4 (Provenance) + Ch 5 (Governance) as protocol requirements, not separate essays.**

### Lifecycle

- Not everything should persist forever. Unbounded accumulation degrades retrieval and increases hallucination risk.
- Minimal requirement: `created_at` + optional `expires_at`. Advanced retention policies are extensions, not core.

### Provenance

- Every memory must trace to its source: human, agent, system, or document.
- The trust chain: human-approved decision > agent-inferred fact > LLM-derived summary.
- Source tracking prevents the Ouroboros problem (LLM-derived memory fed back as ground truth).
- Operational evidence: memhall's `source_tier` enum and anti-circular-reference checks.

### Governance

- Who can read, write, transfer, delete a memory record?
- The "who can forget" problem: deletion is a governance action, not cleanup.
- Audit as append-only event log, not mutable metadata.
- GDPR Article 17 alignment: cryptographic erasure as a protocol-level concern.

### Conflict Resolution

- What happens when two agents write contradictory memories about the same subject?
- Versioning: `version` + `status` (active/superseded/revoked).
- No mandatory consensus mechanism in v0.1 — but the schema must support it.

---

## 3. Multi-Agent Memory Exchange

**The value proposition chapter. Kept standalone — this differentiates AMH from single-agent memory stores.**

- The portability problem: Agent A's memory is useless to Agent B without a common schema.
- Transfer semantics: provenance chain preservation, scope/redaction, recipient trust.
- The "collective intelligence" upside: shared memory as emergent organizational knowledge.
- Practical scenario: Claude records an architecture decision → Codex reads the constraint → Gemini verifies the risk → Human approves → memory promoted to project-level permanent record.

---

## 4. AMH Core Specification

### Memory Record Schema (v0.1 — minimal core)

```json
{
  "amh_version": "0.1",
  "memory_id": "string (unique)",
  "version": "integer",
  "status": "active | superseded | revoked | expired",
  "agent_id": "string",
  "namespace": "string (scoped identifier)",
  "memory_type": "decision | fact | preference | constraint | lesson | risk",
  "content": {
    "format": "MIME type",
    "value": "string | object"
  },
  "source": {
    "type": "human | agent | system | document",
    "ref": "string (URI or identifier)"
  },
  "created_at": "ISO 8601",
  "created_by": "string"
}
```

### Optional Extensions (not required for conformance)

- `confidence` — with mandatory `method` and `calibrated_by` if present
- `expires_at` — ISO 8601 timestamp
- `visibility` — `private | shared | public`
- `policy` — access control block (read/write/transfer/delete)
- `provenance_chain` — array of source records for transferred memories
- `audit_log` — append-only event array

### Four Core Operations

| Operation | Semantics |
|-----------|-----------|
| **write** | Create new record or create new version of existing record. Returns `memory_id` + `version`. |
| **read** | Fetch by ID, or query by namespace + type + agent. Policy-filtered. |
| **transfer** | Copy record to another agent/namespace. Preserves provenance chain. Requires sender + receiver consent. |
| **audit** | Read-only access to append-only event log for a record. |

### Error Model (v0.1)

- `access_denied` — insufficient permissions
- `not_found` — memory_id does not exist
- `expired` — memory has passed expires_at
- `version_conflict` — write conflicts with newer version
- `schema_invalid` — record does not conform to amh_version

### Non-Goals (explicit)

- No embedding standard
- No vector search API
- No memory ranking algorithm
- No agent cognition model
- No universal ontology of memory types
- No replacement for MCP, A2A, OAuth, OIDC, or storage backends

### Relationship to Existing Protocols and Standards

- **MCP**: AMH memories can be exposed as MCP resources
- **A2A**: memory transfer can ride A2A message channels
- **Identity (DID)**: `agent_id` / `created_by` can bind to DID identifiers
- **Dublin Core**: metadata vocabulary alignment
- **W3C VC v2.0**: provenance records can be wrapped as Verifiable Credentials
- **SKOS**: concept graph links between memory records
- **W3C AI Agent Memory Interop CG**: encryption envelope and audit anchor specs (complementary layer)

---

## 5. Roadmap and Call to Action

- AMH is not a product. It is a minimal interchange specification.
- The "Weekend Test": a developer should be able to implement a conforming AMH store in a weekend.
- Reference implementation: `amh-python`
- Adapters: Mem0, Zep, Letta, LangChain Memory import/export
- MCP integration: AMH as MCP resource provider
- Case study: multi-agent dev team memory sharing
- Community: W3C CG alignment, GitHub discussions, blog series

---

## Appendix A: Comparison with Existing Approaches

| Criteria | Mem0 | Zep | Letta | LangChain | MCP KG Server | **AMH** |
|----------|------|-----|-------|-----------|---------------|---------|
| Schema portability | - | - | - | - | - | Core goal |
| Provenance tracking | Partial | - | - | - | - | Core |
| Lifecycle / TTL | Partial | Partial | - | - | - | Core |
| Multi-agent transfer | - | - | - | - | - | Core |
| Audit trail | - | - | - | - | - | Core |
| Open spec | - | - | OSS | OSS | OSS | Open spec |
| Framework-agnostic | Partial | Partial | No | No | MCP only | Yes |
| Git-friendly format | - | - | Yes (MemFS) | - | - | Extension |
| Encryption envelope | - | - | - | - | - | Via W3C CG |

## Appendix B: Academic References

1. Park et al. 2023 — "Generative Agents" (Memory Stream + Reflection, 2000+ citations)
2. Hu et al. 2025 — "Memory in the Age of AI Agents" (arXiv:2512.13564)
3. Jiang et al. 2026 — "Anatomy of Agentic Memory" (arXiv:2602.19320)
4. Packer et al. 2023 — "MemGPT: Towards LLMs as Operating Systems"
5. W3C Verifiable Credentials Data Model v2.0 (2025-05)
6. Wu et al. 2026 — "Agent-Memory Protocol: A Privacy-Focused Protocol" (ICML Workshop)

## Appendix C: Competitive Landscape (2026-06)

| Layer | Existing | Gap |
|-------|----------|-----|
| W3C Standards | AI Agent Memory Interop CG (4 members, no draft) | No usable spec for 12-18 months |
| Open Specs | 5+ AMP variants, UMP, OAMP — none with community convergence | Needs reference impl + benchmark |
| Frameworks | Letta MemFS, Mem0, Zep, Redis | Formats not interoperable |
| Academic | Hu 2025, Jiang 2026 taxonomy | No bridge to engineering specs |
| Enterprise Standards | VC v2.0, SKOS, Dublin Core | Not yet integrated for agent memory |
