# Agent Memory Hall: Toward Portable and Governable Memory for AI Agents

**Version 0.1 — June 2026**

**Author**: Makito Chiba

---

## Abstract

AI agents can call tools (MCP), communicate with each other (A2A), and present verifiable identities (W3C DID). But there is no standard for how agents **remember**. Each framework — Mem0, Zep, Letta, LangChain Memory — invents its own memory model. None of them can exchange memories with another. When you switch frameworks, your agent starts from zero.

Agent Memory Hall (AMH) is an open interchange protocol that standardizes how agent memories are represented, transferred, expired, and audited. AMH is not a memory store, not a cognitive model, and not a replacement for existing frameworks. It is a governance-first wire format: a minimal set of fields and operations that allow any memory system to read, write, and share memory records with any other.

This protocol is informed by operational experience running **memhall**, a multi-agent memory system that served a seven-agent council across sixty collaborative sessions. The lessons learned — content-hash deduplication, namespace isolation, source-tier tracking, and the anti-Ouroboros rule against circular LLM-derived memory — directly shaped AMH's design.

---

## 1. The Problem: Amnesiac Agents in a Multi-Agent World

### 1.1 The Stateless Default

Modern AI agents are stateless by default. A conversation ends; the context window empties; the agent forgets everything. Frameworks bolt on memory as an afterthought — a vector store here, a summary buffer there, a JSON file somewhere. Each framework invents its own schema, its own persistence model, its own retrieval strategy.

The result: **every agent is an island**. A planning agent that decides "use PostgreSQL for the user store" cannot share that decision with the implementing agent in a way that survives a framework switch, a session boundary, or a team handoff.

In multi-agent systems, this problem compounds. Park et al. (2023) demonstrated with Generative Agents that a Memory Stream — a shared, queryable record of experiences — is fundamental to coherent multi-agent behavior. Without it, agents duplicate work, contradict each other, and lose context across sessions. Two years later, the problem remains unsolved at the interchange level.

### 1.2 The Cost of Collective Amnesia

Consider a common scenario in multi-agent software development:

1. **Claude** (the architect) decides: "We will use PostgreSQL. Rationale: team expertise plus JSONB flexibility."
2. **Codex** (the implementer) starts building. It has no access to Claude's decision. It picks SQLite because the codebase has an existing SQLite helper.
3. **Gemini** (the reviewer) flags the inconsistency. But it cannot trace back to the original decision because that memory lives in Claude's session context, which has already been evicted.

The architect's decision was made, stored, and lost — all within the same team, the same project, the same day. Multiply this across dozens of sessions, and the cost of collective amnesia becomes the dominant friction in multi-agent collaboration.

Developer communities have noticed. On Reddit's r/LocalLLaMA and Hacker News, the most common complaints about agent memory are, in order: (1) cross-session memory loss, (2) zero portability between frameworks, (3) confusion between RAG and real memory, (4) multi-agent consistency failures, and (5) no way to audit or selectively forget.

### 1.3 Memory Is Not RAG

A persistent misconception conflates memory with retrieval-augmented generation. The distinction matters:

**RAG is a library. Memory is a biography.**

RAG retrieves documents from a static corpus. Memory records what an agent *knows from experience* — decisions it made, constraints it discovered, lessons it learned, preferences it observed. RAG is read-from-corpus. Memory is write-read-expire-transfer across agents and sessions.

The "RAG with metadata" counterargument — "I can just add a `type: decision` field to my Pinecone vectors" — fails on three counts:

1. **Synthesis**: Memory involves reflection. A hundred session logs should consolidate into one "lesson learned." RAG stores documents; it does not consolidate them into actionable knowledge.
2. **Identity coupling**: Memory is inherently tied to the agent's state. A decision made by Agent A carries different weight than the same text retrieved from a document corpus.
3. **Lifecycle**: Memories expire, get superseded, get revoked. A vector embedding has no mechanism for "this fact was true until last Tuesday."

The academic community has formalized this distinction. Hu et al. (2025) proposed a three-dimensional taxonomy — forms, functions, and dynamics — that separates factual memory, experiential memory, and working memory as distinct cognitive functions. Jiang et al. (2026) demonstrated empirically that existing benchmarks (LoCoMo, LongMemEval) conflate document retrieval with genuine memory operations, proposing the Context Saturation Gap metric to measure when external memory actually matters beyond what a large context window can hold.

AMH takes the position that memory is a first-class engineering concern, distinct from retrieval, and requiring its own interchange standard.

---

## 2. What a Memory Interchange Protocol Must Guarantee

This chapter defines four requirements that any memory interchange protocol must satisfy. These are not features of AMH; they are the minimum bar for any protocol that claims to govern agent memory.

### 2.1 Lifecycle

Not everything should persist forever. In practice, we found that unbounded memory accumulation degrades retrieval quality within weeks. An agent that remembers every observation with equal weight eventually drowns in noise.

A memory interchange protocol must support at minimum:

- **Creation timestamp** (`created_at`): when the memory was first recorded.
- **Optional expiration** (`valid_until`): when this fact stops being true in the world. This is distinct from system-level TTL — it captures the real-world validity window.
- **Status transitions**: a memory can be `active`, `superseded` (replaced by a newer version), `revoked` (explicitly invalidated), or `expired` (past its validity window).
- **Version chaining** (`supersedes`): when a memory is updated, the old version is preserved and linked, not overwritten.

Advanced retention policies — session-scoped, project-scoped, permanent — are valuable but belong in the implementation layer, not the core protocol. AMH v0.1 provides the minimal hooks; implementations add the policy logic.

### 2.2 Provenance

Every memory must trace to its source. This sounds obvious until you see what happens without it.

In our operational experience with memhall, we identified a failure pattern we call the **Ouroboros problem**: an LLM summarizes a set of observations into a "lesson learned." That lesson gets stored in memory. Later, the same LLM retrieves that lesson, treats it as a factual input, and generates a *new* summary that cites the *old* summary. Within three cycles, the memory has drifted from its original grounding, and no one can trace back to the actual evidence.

The fix is source-tier tracking. AMH requires every memory to declare its provenance tier:

- **`raw_source`**: direct observation, original data, or verified external input.
- **`llm_derived`**: generated, summarized, or inferred by an LLM.
- **`human_confirmed`**: reviewed and approved by a human.

The anti-Ouroboros rule is enforced at the protocol level: an `llm_derived` memory cannot supersede another `llm_derived` memory. To update an LLM-derived insight, a human must confirm it, or new raw evidence must be provided. This breaks the self-referential loop.

This three-tier model draws from the broader provenance framework of W3C PROV, adapted for the specific trust dynamics of human-AI collaboration. It aligns with the RAGShield model (arXiv:2604.00387), which demonstrated that consumer-side provenance gating is the most effective defense against knowledge base poisoning in retrieval-augmented systems.

### 2.3 Governance

Memory governance answers four questions:

1. **Who can read this memory?** Namespace isolation ensures that Agent A's private working memory is not leaked to Agent B without explicit transfer.
2. **Who can write?** Not every agent should be able to modify another agent's memories. Write permissions are scoped by namespace and agent identity.
3. **Who can delete?** Deletion is a governance action, not a cleanup task. In regulated environments, "forgetting" must be auditable — you need to prove that a memory was deleted, when, by whom, and why.
4. **What happened to this memory?** An append-only audit log records every operation on every memory record. This is not optional; it is a protocol requirement.

The GDPR dimension is real. Article 17 (Right to Erasure) applies when agent memories contain personal data. The W3C AI Agent Memory Interoperability Community Group (est. June 2026) is developing cryptographic erasure semantics for this exact scenario. AMH's audit log is designed to interoperate with their approach: when a memory is erased, the audit log retains a tombstone record (proving deletion occurred) while the content itself is destroyed.

### 2.4 Conflict Resolution

In multi-agent systems, memory conflicts are inevitable. Agent A remembers "the user prefers Python." Agent B learns "the user switched to Rust last week." Both memories are valid at different points in time; neither is wrong.

AMH handles this through versioning rather than consensus:

- Every update creates a new version linked to its predecessor via `supersedes`.
- The old version's status changes to `superseded`, but it remains queryable for historical analysis.
- Point-in-time queries can retrieve the state of memory at any historical timestamp.

AMH v0.1 does not mandate a consensus mechanism. In practice, we found that human-in-the-loop resolution (a human reviews conflicting memories and confirms which is current) works better than automated consensus for high-stakes decisions. The protocol provides the machinery for conflict detection and version tracking; the resolution strategy is left to the implementation.

---

## 3. Multi-Agent Memory Exchange

This chapter describes the core value proposition that distinguishes AMH from single-agent memory stores.

### 3.1 The Portability Problem

Today, agent memory is locked inside frameworks. Mem0 memories cannot be read by a Letta agent. A LangChain Memory export cannot be imported into a custom system without manual transformation. This lock-in is the memory equivalent of the pre-MCP tool integration problem — and it persists because no one has defined a common wire format.

AMH defines that wire format. A memory record in AMH is a self-contained JSON object with all the metadata needed to understand it: who created it, when, why, how trustworthy it is, and when it expires. Any system that can parse this JSON can use the memory.

### 3.2 Transfer Semantics

Memory transfer between agents is not a simple copy. When Agent A sends a memory to Agent B, several things must happen:

1. **Provenance chain preservation**: The transferred memory retains its full history. Agent B can see that this memory was originally created by Agent A, from a human-confirmed source, at a specific time.
2. **Source reference update**: The transferred copy's source reference points back to the original, creating a traceable lineage.
3. **Namespace transition**: The memory moves from Agent A's namespace to Agent B's, subject to the governance rules of both namespaces.
4. **Tier preservation**: The source tier does not change on transfer. An `llm_derived` memory remains `llm_derived` even when transferred to a new agent — it does not magically become more trustworthy by changing hands.

### 3.3 A Practical Scenario

Consider a multi-agent development team:

1. **Claude** (architect) writes a memory: `{ type: "decision", content: "Use PostgreSQL", tier: "human_confirmed" }` in namespace `project:acme`.
2. **Codex** (implementer) queries namespace `project:acme` for all `constraint` and `decision` type memories before writing code. It reads Claude's decision and respects it.
3. **Gemini** (reviewer) reads the decision memory during code review, verifies the implementation matches the architectural intent.
4. Two weeks later, the team switches to MySQL. Claude writes a new memory that `supersedes` the PostgreSQL decision. The old decision's status becomes `superseded`. Any agent querying for active decisions now sees only MySQL.
5. A month later, someone asks "why did we originally pick PostgreSQL?" The superseded memory is still there, with its full rationale, queryable by version history.

This scenario — routine in human software teams — is currently impossible across most multi-agent frameworks because there is no common memory format.

### 3.4 Collective Intelligence

When memories are portable and governed, something emergent happens: the multi-agent system develops **organizational knowledge**. Individual agent observations consolidate into shared understanding. Decisions accumulate into institutional memory. Lessons learned by one agent become constraints respected by all.

This is not artificial general intelligence. It is knowledge management — a problem that enterprises have been solving for decades with standards like Dublin Core, SKOS, and Verifiable Credentials. AMH applies these proven patterns to the agent ecosystem.

---

## 4. AMH Core Specification

### 4.1 Memory Record Schema (v0.1)

An AMH memory record is a JSON object with the following required fields:

```json
{
  "amh_version": "0.1",
  "memory_id": "dade8399-fec1-4771-bdaa-80584326d84f",
  "version": 1,
  "status": "active",
  "agent_id": "claude-architect",
  "namespace": "project:acme",
  "memory_type": "decision",
  "content": {
    "format": "text/plain",
    "value": "Use PostgreSQL for the user store. Rationale: team expertise plus JSONB flexibility."
  },
  "source": {
    "type": "human",
    "ref": "session:2026-06-15-arch-review",
    "tier": "human_confirmed"
  },
  "created_at": "2026-06-15T09:30:00Z",
  "created_by": "claude-architect"
}
```

#### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `amh_version` | `"0.1"` | Protocol version |
| `memory_id` | string | Unique identifier (UUID recommended) |
| `version` | integer | Monotonically increasing version number |
| `status` | enum | `active` \| `superseded` \| `revoked` \| `expired` |
| `agent_id` | string | Identifier of the owning agent |
| `namespace` | string | Scoped namespace (e.g., `project:acme`, `agent:claude`) |
| `memory_type` | enum | `decision` \| `fact` \| `preference` \| `constraint` \| `lesson` \| `risk` |
| `content.format` | string | MIME type (e.g., `text/plain`, `text/markdown`, `application/json`) |
| `content.value` | string | The memory content |
| `source.type` | enum | `human` \| `agent` \| `system` \| `document` |
| `source.ref` | string | Source reference (URI or identifier) |
| `source.tier` | enum | `raw_source` \| `llm_derived` \| `human_confirmed` |
| `created_at` | string | ISO 8601 timestamp |
| `created_by` | string | Identifier of the creating agent or human |

#### Optional Extensions

| Field | Type | Description |
|-------|------|-------------|
| `valid_until` | string | ISO 8601. When this fact stops being true in the world. |
| `supersedes` | string | `memory_id` of the record this replaces |
| `content_hash` | string | SHA-256 of `content.value`, for deduplication |
| `confidence` | object | `{ value: number, method: string, calibrated_by: string }` |
| `visibility` | enum | `private` \| `shared` \| `public` |
| `policy` | object | Access control rules (read/write/transfer/delete) |
| `provenance_chain` | array | Source records for transferred memories |
| `audit_log` | array | Append-only event log |

### 4.2 Memory Types

AMH defines six memory types, chosen for business-semantic clarity:

| Type | Description | Example |
|------|-------------|---------|
| `decision` | A choice that was made, with rationale | "Use PostgreSQL. Rationale: team expertise." |
| `fact` | A verified piece of information | "The API rate limit is 1000 req/min." |
| `preference` | A user or system preference | "Maki prefers concise commit messages in Chinese." |
| `constraint` | A boundary that must not be violated | "Do not deploy to production on Fridays." |
| `lesson` | Something learned from failure or success | "Codex sandbox blocks writes outside workdir." |
| `risk` | A known danger or uncertainty | "The auth token expires silently after 30 days." |

This taxonomy differs from the cognitive-architecture approach used by UMP (semantic/episodic/procedural/working/identity). AMH's types are designed for the language of product managers, architects, and operations teams — not cognitive scientists. Both approaches are valid; AMH provides a crosswalk mapping for interoperability.

### 4.3 Operations

AMH defines four core operations:

#### `write`

Create a new memory record or create a new version of an existing record.

- Validates the record against the AMH schema.
- Runs the write-gate pipeline: dedup check → source-tier validation → anti-Ouroboros check → namespace permission check.
- Computes `content_hash` for deduplication.
- If `supersedes` is set, marks the parent record as `superseded`.
- Appends a write event to the audit log.
- Returns `{ memory_id, version }`.

#### `read`

Query memories by ID, namespace, type, agent, status, or text search.

- Single-record fetch by `memory_id`.
- Filtered queries: `{ namespace: "project:acme", memory_type: "decision", status: "active" }`.
- Text search within `content.value`.
- Policy-filtered: respects namespace isolation and visibility rules.

#### `transfer`

Copy a memory record to another agent or namespace, preserving the provenance chain.

- Creates a new record in the target namespace.
- Sets `source.ref` to `transfer:{original_memory_id}`.
- Preserves `source.tier` (tier does not upgrade on transfer).
- Appends a transfer event to both source and target audit logs.
- Returns `{ new_memory_id, source_memory_id }`.

#### `audit`

Read-only access to the append-only event log for a memory record.

- Returns all events: writes, reads, transfers, status changes.
- Each event includes: `event_id`, `memory_id`, `operation`, `agent_id`, `timestamp`, `details`.
- The audit log is append-only; events cannot be modified or deleted.

### 4.4 Governance Defaults

AMH ships with governance enabled by default. Implementations MAY allow disabling individual checks, but the defaults are:

| Check | Default | Description |
|-------|---------|-------------|
| Content-hash dedup | ON | Rejects writes with identical content in the same namespace |
| Anti-Ouroboros | ON | Blocks `llm_derived` → `llm_derived` supersession chains |
| Namespace isolation | ON | Reads are scoped to the requesting agent's namespace |
| Source-tier validation | ON | Validates that `source.tier` is a recognized value |

These defaults exist because we learned, operationally, that ungoverned memory systems degrade within weeks. Deduplication prevents bloat. Anti-Ouroboros prevents hallucination amplification. Namespace isolation prevents information leakage. These are not theoretical concerns; they are bugs we encountered and fixed in production.

### 4.5 Error Model

| Error | Description |
|-------|-------------|
| `access_denied` | Insufficient permissions for the requested operation |
| `not_found` | The specified `memory_id` does not exist |
| `expired` | The memory has passed its `valid_until` timestamp |
| `version_conflict` | A write conflicts with a newer version of the record |
| `schema_invalid` | The record does not conform to the declared `amh_version` |
| `duplicate_content` | Content hash matches an existing active record in the same namespace |
| `ouroboros_violation` | An `llm_derived` record attempted to supersede another `llm_derived` record |

### 4.6 Non-Goals

AMH explicitly does **not** define:

- An embedding format or vector representation standard.
- A search or ranking algorithm.
- A memory generation or reflection strategy.
- A cognitive architecture or agent reasoning model.
- A universal ontology of memory types (the six types are a practical default, not a normative taxonomy).
- A replacement for MCP, A2A, OAuth, OIDC, or any storage backend.

AMH is boring infrastructure. That is the point.

### 4.7 Relationship to Existing Standards

| Standard | Relationship |
|----------|-------------|
| **MCP** | AMH memories can be exposed as MCP resources. The reference implementation ships as an MCP server. |
| **A2A** | Memory transfer can ride A2A message channels when available. |
| **W3C DID** | `agent_id` and `created_by` can bind to DID identifiers for verifiable identity. |
| **Dublin Core** | Metadata vocabulary alignment: `created_at` ↔ `dc:created`, `created_by` ↔ `dc:creator`. |
| **W3C VC v2.0** | Provenance records can be wrapped as Verifiable Credentials for cryptographic proof. |
| **SKOS** | Concept graph links between memory records can use SKOS relations. |
| **W3C AI Agent Memory Interop CG** | AMH is complementary. The CG focuses on encryption envelopes and audit anchors; AMH focuses on semantic format and interchange. |
| **UMP** | AMH provides import/export adapters for UMP records. The `memory_type` ↔ `kind` crosswalk enables bidirectional conversion. |

---

## 5. Roadmap and Call to Action

### 5.1 What Exists Today

- **Reference implementation**: `@chibakuma/agent-memory-hall` on npm. One command to start: `npx @chibakuma/agent-memory-hall`.
- **MCP server**: Six tools (`amh_write`, `amh_read`, `amh_transfer`, `amh_forget`, `amh_audit`, `amh_status`) compatible with Claude Desktop, Cursor, and any MCP host.
- **Import adapters**: UMP and Mem0 bidirectional conversion.
- **Governance layer**: Content-hash dedup, anti-Ouroboros, namespace isolation, source-tier validation — all enabled by default.

### 5.2 What Comes Next

| Timeline | Deliverable |
|----------|------------|
| July 2026 | SQLite store adapter + Letta MemFS import adapter |
| August 2026 | LoCoMo + LongMemEval benchmark results (Hindsight AMB framework, public judge prompt) |
| September 2026 | Case study: multi-agent dev team memory governance |
| October 2026 | Public spec freeze (v1.0) + community RFC period |
| November 2026 | Blog series + conference submissions |
| December 2026 | v1.0 release |

### 5.3 The Weekend Test

The spec is right-sized when a competent developer can implement a conforming AMH store in a weekend. The current schema has 14 required fields and 4 operations. The reference implementation is 700 lines of TypeScript. If this grows beyond what a single developer can hold in their head, we have failed.

### 5.4 How to Participate

- **GitHub**: [github.com/MakiDevelop/agent-memory-hall](https://github.com/MakiDevelop/agent-memory-hall)
- **npm**: `npm install @chibakuma/agent-memory-hall`
- **Issues**: Bug reports, feature requests, and spec discussions welcome.
- **Adapters**: We especially welcome community-contributed adapters for Zep, Cognee, LangGraph, and other frameworks.

---

## References

1. Park, J. S., O'Brien, J. C., Cai, C. J., et al. (2023). "Generative Agents: Interactive Simulacra of Human Behavior." *UIST 2023*. arXiv:2304.03442.
2. Hu, C., et al. (2025). "Memory in the Age of AI Agents." arXiv:2512.13564.
3. Jiang, F., et al. (2026). "Anatomy of Agentic Memory: Taxonomy and Empirical Analysis." arXiv:2602.19320.
4. Packer, C., Wooders, S., Lin, K., et al. (2023). "MemGPT: Towards LLMs as Operating Systems." arXiv:2310.08560.
5. W3C. (2025). "Verifiable Credentials Data Model v2.0." W3C Recommendation.
6. W3C. (2026). "AI Agent Memory Interoperability Community Group Charter." Proposed 2026-05-18, established 2026-06-03.
7. Wu, et al. (2026). "Agent-Memory Protocol: A Privacy-Focused Protocol for LLM Agents." *ICML Workshop on Foundation Models in the Wild*.
8. Hasaj, E., & Ibryam, B. (2026). "Universal Memory Protocol v0.1." universalmemoryprotocol.io.
9. Letta. (2026). "Introducing Context Repositories: Git-based Memory for Coding Agents." letta.com/blog.
10. Vectorize. (2026). "Agent Memory Benchmark: A Manifesto." hindsight.vectorize.io.

---

*Agent Memory Hall is licensed under Apache 2.0. The protocol specification is freely available for implementation by any framework, tool, or service.*
