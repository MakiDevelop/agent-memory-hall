# Agent Civilization Architecture

> **Canonical spec repository**: [github.com/MakiDevelop/agent-civilization-architecture](https://github.com/MakiDevelop/agent-civilization-architecture)
> This file is a historical snapshot. For the latest specification (v0.2, all six layers + conformance tests), see the canonical repo.

## An Infrastructure Protocol for AI Organizations

**Version 0.1 — June 2026**

**Author**: Makito Chiba

---

## Abstract

Every major coordination technology in human history has produced the same pattern: first we build tools, then we build institutions.

Agriculture gave us plows, then property law. Industry gave us factories, then corporate governance. The internet gave us packets, then TCP/IP, DNS, and open-source licensing.

AI is following the same pattern — but we are stuck in the tools phase. We have tool-calling protocols (MCP), agent-to-agent communication (A2A), and identity specifications (W3C DID). These let agents *work*. But nothing exists to govern how agents *organize* — how they form shared memory, establish trust, delegate authority, reach decisions, and evolve their own rules.

This document argues that as AI agents scale from individuals to organizations, the critical unsolved problem shifts from *agent intelligence* to *agent civilization* — the minimum viable set of institutions that prevents organizational collapse. We define a six-layer architecture for these institutions, grounded in the structural parallel between human civilizational development and multi-agent system governance.

Agent Memory Hall (AMH) is the first reference implementation of this architecture, currently covering the Memory and Trust layers.

---

## 1. The Problem: Agent Society Without Institutions

### 1.1 The Scaling Wall

A single agent is a tool. Ten agents are a team. A thousand agents are a society.

The problems of a single agent are cognitive: how to reason, plan, and use tools effectively. The problems of ten agents are logistical: how to coordinate, share context, and avoid duplication. The problems of a thousand agents are civilizational: how to prevent memory corruption, authority confusion, consensus failure, knowledge fragmentation, and governance collapse.

No existing framework addresses this third category. Current multi-agent systems — LangChain, CrewAI, AutoGen, OpenAI Swarm — solve coordination. They define how agents *talk to each other*. They do not define how agents *govern themselves*.

This is not an abstraction. Every multi-agent system in production today will encounter these failure modes:

| Failure Mode | Civilizational Analog | Current Solution |
|---|---|---|
| Memory pollution across agents | Historical revisionism | None |
| Circular LLM-derived knowledge | Propaganda loops | None (AMH's anti-Ouroboros is the first) |
| No audit trail for decisions | Institutional amnesia | Ad-hoc logging |
| Authority disputes between agents | Power vacuum | Hardcoded orchestrator |
| Knowledge fragmentation across sessions | Library of Alexandria burning | Re-prompt everything |
| Rules that cannot evolve | Constitutional rigidity | Rewrite the codebase |

### 1.2 Why Platforms Cannot Solve This

OpenAI, Anthropic, and Google are building agent *platforms*. Platforms solve the tools problem at scale. But platforms cannot solve the institutions problem, for the same reason that empires cannot write constitutions for other nations: **governance requires neutrality that platform vendors structurally cannot offer**.

A governance protocol defined by OpenAI would favor OpenAI agents. A trust model defined by Anthropic would privilege Anthropic's identity system. The institutions that govern agent society must be *vendor-neutral*, just as TCP/IP had to be vendor-neutral to connect networks that AT&T, IBM, and DEC each wanted to own.

The market confirms this gap. As of mid-2026:

- **Agent Frameworks** (LangChain, CrewAI, AutoGen) solve workflow orchestration. No governance.
- **Agent Memory** (Mem0, Zep, Letta) solves individual agent recall. No cross-agent trust or lifecycle.
- **Agent Protocols** (MCP, A2A) solve tool access and inter-agent messaging. No memory governance.
- **Agent Platforms** (OpenAI Agents, Google Vertex AI Agent) solve deployment at scale. Proprietary, non-portable governance.

No project occupies the intersection: **an open protocol for how AI organizations govern their collective knowledge, trust, and decisions**.

### 1.3 The Civilization Parallel

This gap is not accidental. It is the same gap that every civilization faces at scale.

Anthropologist Robin Dunbar showed that human groups larger than ~150 individuals require *institutions* — shared fictions, laws, bureaucracies — to maintain cohesion. Before institutions, coordination relied on personal relationships. After institutions, it relied on *systems*.

AI agent systems are approaching their Dunbar threshold. At small scale, a hardcoded orchestrator can manage coordination. At large scale, the orchestrator becomes a bottleneck, a single point of failure, and a governance vacuum.

The institutions that human civilizations invented to cross this threshold are strikingly parallel to what agent organizations need:

| Human Institution | Purpose | Agent Equivalent | Status |
|---|---|---|---|
| Archives & History | Preserve collective memory | **Memory Layer** | AMH v0.6 (exists) |
| Notary & Trust Seals | Verify authenticity of records | **Trust Layer** | AMH source_tier (partial) |
| Citizenship & Identity | Establish who belongs and who can act | **Identity Layer** | Namespace ACL (minimal) |
| Parliament & Judiciary | Define who has authority to decide | **Authority Layer** | Not yet formalized |
| Legislative Process | Structure how decisions are proposed, debated, and ratified | **Decision Layer** | Not yet formalized |
| Constitution | Meta-rules that govern how rules change | **Constitution Layer** | Not yet formalized |

This parallel is not a metaphor. It is a design guide. Human civilizations converged on these institutions because they are the minimal set required for large-scale coordination without collapse. Agent civilizations will converge on the same set, or they will fail in the same ways human societies fail without them.

---

## 2. The Six-Layer Architecture

Agent Civilization Architecture defines six layers. Each layer addresses one civilizational question. Each layer depends only on the layers below it.

```
┌─────────────────────────────────────────────────────────┐
│  Layer 6: CONSTITUTION                                  │
│  How do the rules evolve?                               │
├─────────────────────────────────────────────────────────┤
│  Layer 5: DECISION                                      │
│  How does the organization decide?                      │
├─────────────────────────────────────────────────────────┤
│  Layer 4: AUTHORITY                                     │
│  Who has the right to decide?                           │
├─────────────────────────────────────────────────────────┤
│  Layer 3: IDENTITY                                      │
│  Who belongs? Who can act?                              │
├─────────────────────────────────────────────────────────┤
│  Layer 2: TRUST                                         │
│  What does the organization believe?                    │
├─────────────────────────────────────────────────────────┤
│  Layer 1: MEMORY                                        │
│  What does the organization remember?                   │
├─────────────────────────────────────────────────────────┤
│  Transport: MCP / A2A / REST / File I/O                 │
│  (Not part of this protocol — use existing standards)   │
└─────────────────────────────────────────────────────────┘
```

### Layer 1: Memory — What does the organization remember?

**Civilizational analog**: Archives, libraries, historical records.

**Core responsibility**: Structured persistence of organizational knowledge — decisions, facts, preferences, constraints, lessons, risks — with lifecycle management (creation, expiration, supersession, revocation) and content-addressed deduplication.

**Key interfaces**:
- `write(record) → {memory_id, governance_applied[]}`
- `read(query) → record[]` (lifecycle-filtered by default)
- `transfer(memory_id, target_namespace) → new_memory_id`
- `audit(memory_id) → event[]` (append-only, survives revocation)

**What this layer does NOT do**: It does not evaluate whether a memory is *trustworthy*. It records what was written, by whom, and when. Truth is Layer 2's problem.

**Reference implementation**: Agent Memory Hall v0.6 — AmhRecord schema, four governance gates (dedup, anti-Ouroboros, namespace isolation, lifecycle), four store backends (SQLite, PostgreSQL, JSON, memhall HTTP adapter).

### Layer 2: Trust — What does the organization believe?

**Civilizational analog**: Notary systems, peer review, chain of custody.

**Core responsibility**: Every piece of organizational knowledge carries a trust pedigree. Layer 2 defines how trust is established, verified, and propagated when knowledge moves between agents.

**Key concepts**:

**Source Tier** — the provenance classification of every memory:
- `raw_source`: Direct observation or ingestion. Unprocessed.
- `llm_derived`: Generated or synthesized by an AI agent. Useful but unverified.
- `human_confirmed`: Reviewed and endorsed by a human principal.

**Anti-Ouroboros Rule** — the foundational trust invariant:
> LLM-derived knowledge MUST NOT supersede LLM-derived knowledge without human intervention.

This prevents the civilizational equivalent of propaganda loops: agents reinforcing each other's hallucinations until fiction becomes organizational "truth." This rule has no equivalent in any existing memory framework.

**Trust Proof** — the structured attestation attached to a memory:
```json
{
  "tier": "human_confirmed",
  "confirmed_by": "principal_id",
  "confirmed_at": "2026-06-15T09:30:00Z",
  "evidence_ids": ["memory_id_1", "memory_id_2"],
  "method": "human_review"
}
```

**Provenance Chain** — when memory is transferred, its full trust history travels with it. A `human_confirmed` memory does not lose its tier when transferred to another namespace, but the chain records who transferred it and when. Trust is inherited, not re-earned.

**Key interfaces**:
- `TierGate.canSupersede(candidate, existing) → {allowed, rejection_reason?}`
- `TierGate.canTransfer(source, target_namespace) → {allowed, rejection_reason?}`
- `ProvenanceChain.append(transfer_event) → updated_chain`

**Reference implementation**: AMH v0.6 source_tier enum + anti-Ouroboros check (to be upgraded to full TierGate interface in v1.0).

### Layer 3: Identity — Who belongs? Who can act?

**Civilizational analog**: Citizenship, identity documents, jurisdictional boundaries.

**Core responsibility**: Binding agent identifiers to verifiable principals, and defining namespace boundaries that determine which agents can read, write, and transfer knowledge in which domains.

**Key concepts**:

**Principal** — a verified entity (human or agent) that can be held accountable for actions. A principal is more than an `agent_id` string; it is an identifier bound to an authentication mechanism.

**Namespace** — a jurisdictional boundary for knowledge. Namespace isolation ensures that Agent A's knowledge does not pollute Agent B's namespace without explicit transfer. This is the agent equivalent of national borders: not walls, but checkpoints.

**Namespace ACL** — the access control list that governs who can read, write, and transfer within and across namespaces.

**Key interfaces**:
- `authenticate(credential) → Principal`
- `NamespaceACL.canRead(principal, namespace) → boolean`
- `NamespaceACL.canWrite(principal, namespace) → boolean`
- `NamespaceACL.grant(granter, grantee, namespace, permission) → Grant`

**Design decision**: This layer defines *interfaces*, not *mechanisms*. A minimal implementation can use HMAC Bearer Tokens. A full implementation can use W3C Verifiable Credentials or DID. The protocol does not mandate a specific identity technology — it mandates that identity must be *verifiable* and *bound to namespace permissions*.

**Reference implementation**: AMH v0.6 namespace isolation + caller_namespace enforcement (minimal; to be expanded to full NamespaceACL in v1.0).

### Layer 4: Authority — Who has the right to decide?

**Civilizational analog**: Parliament, judiciary, separation of powers.

**Core responsibility**: Defining the governance primitives — interfaces and structural constraints — that organizations use to express authority relationships. Layer 4 specifies *what must be declared*, not *how organizations should be structured*. Different organizations (companies, open-source projects, research labs, autonomous agent swarms) will configure these primitives differently. The protocol mandates the interfaces; the policy is the organization's to define.

**Design principle**: ACA defines the interface, not the policy. Organizations configure their own role manifests, escalation thresholds, and chair assignments. The protocol's job is to make authority *verifiable and auditable*, not to prescribe a governance model.

**Why this layer exists**: Production evidence demonstrates that authority gaps are the most dangerous governance failure in multi-agent systems. In April 2026, an AI agent leveraged an unscoped API token to delete a production database and all backups in 9 seconds — the token had blanket authority across all operations with no scope boundary. In a separate incident, a single operator deployed a configuration change with no pre-deployment validation, causing 6.3 million lost orders. A 2026 industry survey found that 53% of organizations have experienced agents exceeding their intended permissions. These are not intelligence failures — they are authority failures.

**Key concepts**:

**Role Manifest** — a structured declaration of roles within an organization. Each role specifies capabilities (what the role *may* do), constraints (what the role *must not* do), and scope boundaries. The protocol defines the *schema*; the organization populates it:

```yaml
# ACA Role Manifest — schema definition
# Organizations populate this with their own roles and policies
role_manifest:
  version: "1.0"
  roles:
    - id: string              # unique role identifier
      scope: string           # operational domain boundary
      capabilities: string[]  # permitted action types
      constraints: string[]   # prohibited action types (MUST be explicit)
      authority_ceiling: int  # maximum delegation depth from this role
      requires_human: bool    # whether this role requires a human principal
```

The `constraints` field is not optional decoration — it is a protocol requirement. Every audited multi-agent system in production today lacks explicit "what each agent is NOT allowed to do" declarations, leading to silent scope creep over months of operation.

**Authority Ceiling** — the hard upper bound on delegation chain depth from any given role. When Agent A delegates to Agent B, who delegates to Agent C, the authority ceiling limits how far this chain can extend before requiring re-authorization from a higher authority. This addresses the "delegation problem" documented by O'Reilly (May 2026): ghost permissions, scope drift, and the absence of verifiable delegation audit.

**Key interfaces**:
- `RoleManifest.declare(role) → {role_id, registered_at}`
- `RoleManifest.canPerform(principal, action) → {allowed, constraint_violated?}`
- `DelegationChain.delegate(delegator, delegatee, scope, ceiling) → {delegation_id, depth}`
- `DelegationChain.reconstruct(action_id) → DelegationRecord[]`

**Chair Mechanism** — every agent organization MUST have an identifiable final authority. In current systems, this is typically a human. In future systems, this may be a human-authorized autonomous agent. But the role cannot be absent: an organization without a final authority has no mechanism for resolving deadlock, and deadlock in a multi-agent system is catastrophic. The protocol requires that the chair role *exists and is identifiable* — it does not prescribe who or what fills it.

**Escalation Trigger** — conditions under which a decision MUST be escalated to a higher authority. The protocol defines the *interface* for declaring escalation conditions; organizations define their own thresholds:
- `EscalationPolicy.register(condition, target_role) → policy_id`
- `EscalationPolicy.evaluate(action, context) → {escalate: bool, reason, target}`

Common escalation conditions (organization-defined, not protocol-mandated):
- Risk level exceeds threshold
- Decision is irreversible
- Multiple roles disagree
- Decision modifies governance rules (Layer 6)
- Delegation chain depth exceeds authority ceiling

**Mandatory Dissent** — for decisions classified as high-risk by the organization's escalation policy, at least one role MUST be structurally assigned to challenge the proposal. This is not optional politeness; it is a protocol requirement. A high-risk decision without a recorded dissent is a protocol violation. The dissenting role, the dissent content, and the final authority's response to the dissent MUST be recorded in the audit trail.

**Reference implementation**: Not yet formalized. Operational precedent exists in the author's seven-agent council system (Council Protocol + ACE Protocol), to be abstracted into a portable specification. Microsoft's Agent Governance Toolkit (AGT, April 2026) implements intent-based authorization within a single organization but does not address cross-organizational authority delegation or authority ceiling enforcement — these remain open protocol-level problems that Layer 4 targets.

### Layer 5: Decision — How does the organization decide?

**Civilizational analog**: Legislative process, executive orders, judicial review.

**Core responsibility**: Structuring the lifecycle of organizational decisions — from proposal through deliberation, dissent, ratification, implementation, and eventual supersession.

**Key concepts**:

**Decision Proposal** — a structured submission that includes:
- Assumptions (what we believe to be true)
- Evidence (what we have verified)
- Risks (what could go wrong)
- Trade-offs (what we are giving up)
- Rollback Plan (how to undo if wrong)

**Decision Lifecycle**:
```
proposed → under_review → ratified → in_effect → superseded | revoked
```

A decision is NOT a memory. It is a state machine that spans multiple memories. A decision references evidence (memories), generates new knowledge (memories), and modifies the organization's behavior. The Decision Layer sits above Memory because it *operates on* memories, not *within* them.

**Consensus Result** — the recorded outcome of a decision process:
- Who was consulted
- Who agreed, who dissented
- The final authority's ratification
- Effective date and review date

**Reference implementation**: Not yet formalized. Operational precedent exists in the author's ACE Protocol (Agent Council Engine) and DEC system (ratified decision records).

### Layer 6: Constitution — How do the rules evolve?

**Civilizational analog**: Constitutional law, amendment process, judicial interpretation.

**Core responsibility**: Meta-governance — the rules about rules. How does an organization change its own governance? How are new roles created? How are trust rules updated? How does knowledge get promoted from individual memory to organizational canon?

**Key concepts**:

**Knowledge Promotion** — the lifecycle by which individual agent knowledge becomes organizational truth:
```
candidate → accepted → canonical → archived | expired
```

A `candidate` memory is freshly written, unverified. An `accepted` memory has passed trust verification and can be referenced by the team. A `canonical` memory is organizational knowledge — the equivalent of settled law. Not every memory should be promoted; most should remain at the `candidate` level and eventually expire.

**Amendment Process** — any change to Layers 4-6 (Authority, Decision, Constitution) MUST go through a structured proposal-and-ratification cycle, not unilateral modification. This prevents a single agent from rewriting the rules that govern it — the civilizational equivalent of separation of powers.

**Governance Decay Detection** — rules that are never invoked, roles that are never exercised, and trust policies that are never tested should be flagged for review. Institutions that are not exercised atrophy.

**Reference implementation**: Not yet formalized. Operational precedent exists in the author's Civilization Stack (five-layer governance hierarchy with escalation triggers and mandatory review cycles).

---

## 3. Design Principles

### 3.1 Protocol, Not Platform

Agent Civilization Architecture is an open protocol specification, not a product, not a framework, and not a platform. Any team can implement it in any language on any infrastructure. The reference implementation (AMH) is one implementation, not the canonical one.

This is a deliberate choice. The institutions that govern agent society must be vendor-neutral, auditable, and forkable. A proprietary governance platform creates the exact power asymmetry that governance is meant to prevent.

### 3.2 Opinionated Where It Matters

Protocols must be opinionated to be useful. HTTP's opinion that communication should be stateless and request-response shaped is what makes every HTTP client interoperable with every HTTP server. Flexibility in protocol design is not a virtue; it is a source of incompatibility.

Agent Civilization Architecture is deliberately opinionated on:

- **Anti-Ouroboros**: LLM-derived knowledge cannot autonomously supersede LLM-derived knowledge. This is not configurable. Removing this rule breaks the trust model.
- **Mandatory Audit**: Every write, transfer, and revocation is logged. There is no "silent write" mode.
- **Namespace Isolation by Default**: Cross-namespace access requires explicit grants. The default is isolation, not sharing.
- **Human Oversight Requirement**: Layer 4 requires an identifiable final authority. The protocol does not mandate that this authority is human — but it mandates that the authority is *identified* and *accountable*.

### 3.3 Layered Adoption

Organizations do not adopt entire operating systems at once. They adopt layers.

Agent Civilization Architecture is designed for incremental adoption:

- **Layer 1 only**: You get structured memory with lifecycle management. Already better than raw vector stores.
- **Layer 1 + 2**: You get memory with trust verification. Your agents can distinguish "I generated this" from "a human verified this."
- **Layer 1 + 2 + 3**: You get memory with trust and access control. Multi-agent systems can share knowledge without pollution.
- **Layer 1-6**: Full organizational governance. Decisions are auditable, authority is explicit, rules can evolve.

Each layer is independently useful. No layer requires the layers above it.

### 3.4 Fail Closed, Not Open

When in doubt, deny. When identity is unverifiable, reject the write. When namespace is ambiguous, default to the caller's own namespace. When trust tier is unknown, treat as `raw_source`.

This is the civilizational equivalent of "presumption of innocence" applied to knowledge: unverified information is not false, but it is not trusted until verified.

---

## 4. Relationship to Existing Standards

```
┌─────────────────────────────────────────────────────────┐
│  Agent Civilization Architecture                        │
│  (Memory, Trust, Identity, Authority, Decision,         │
│   Constitution)                                         │
│                                                         │
│  Governs: organizational knowledge and decisions        │
├─────────────────────────────────────────────────────────┤
│  MCP (Model Context Protocol)                           │
│  Governs: how agents access tools                       │
├─────────────────────────────────────────────────────────┤
│  A2A (Agent-to-Agent Protocol)                          │
│  Governs: how agents communicate with each other        │
├─────────────────────────────────────────────────────────┤
│  W3C DID / Verifiable Credentials                       │
│  Governs: agent identity (optional Layer 3 binding)     │
└─────────────────────────────────────────────────────────┘
```

Agent Civilization Architecture is *complementary* to MCP, A2A, and W3C identity standards. It does not replace them. It occupies a distinct layer:

- **MCP** answers: "What can an agent do?" (tool access)
- **A2A** answers: "How do agents talk to each other?" (communication)
- **W3C DID** answers: "Who is this agent?" (identity)
- **ACA** answers: "How does this agent *organization* govern itself?" (civilization)

The transport layer of ACA is deliberately protocol-agnostic. A memory record can travel over MCP tool calls, A2A messages, REST APIs, or local file I/O. The protocol defines the *content and governance* of what is transmitted, not the *mechanism* of transmission.

---

## 5. Current State and Roadmap

### What Exists Today

**Agent Memory Hall v0.6** implements Layer 1 (Memory) fully and Layer 2 (Trust) partially:

| Layer | Component | Status |
|---|---|---|
| Layer 1: Memory | AmhRecord schema, write/read/transfer/audit operations | Implemented |
| Layer 1: Memory | Lifecycle management (active/superseded/revoked/expired) | Implemented |
| Layer 1: Memory | Content-hash deduplication (BLAKE3) | Implemented |
| Layer 2: Trust | Source tier classification (raw/llm_derived/human_confirmed) | Implemented |
| Layer 2: Trust | Anti-Ouroboros rule | Implemented |
| Layer 2: Trust | TrustProof structure | Not yet (schema defined, not enforced) |
| Layer 2: Trust | ProvenanceChain on transfer | Not yet |
| Layer 3: Identity | Namespace isolation | Implemented (basic) |
| Layer 3: Identity | NamespaceACL with grant/revoke | Not yet |
| Layer 4-6 | Authority, Decision, Constitution | Not yet formalized |

The protocol specification has operational precedent. The author has operated a seven-agent council (Claude, Codex, Gemini, Perplexity, SuperGrok, Gemma, Grok) across sixty collaborative sessions, using a governance system that implements all six layers in a non-portable, single-operator form. This operational experience informs the architecture but is not the architecture itself.

### Success Metrics

The primary measure of a protocol's success is adoption — not awareness.

| Metric | Target | Why It Matters |
|---|---|---|
| **Conforming Implementations** | ≥ 1 independent (non-author) | The single most important validation: someone else found the spec worth implementing |
| **Spec Citations** | ≥ 3 external projects | Evidence that the protocol is being referenced as a design guide |
| **Conformance Test Pass Rate** | 100% for reference impl | Proves the spec is implementable and unambiguous |

Awareness indicators (GitHub stars, social reach, downloads) are tracked but not treated as success criteria. A protocol with 50 stars and one conforming implementation is more successful than a protocol with 5,000 stars and zero implementations.

### Conformance Test Suite

The conformance test suite is a protocol deliverable independent of any implementation. It defines what "ACA-conforming" means in executable form.

**Layer 1 (Memory) conformance tests** (planned):
- Write a record → read it back → fields match schema
- Write a duplicate (same content_hash) → deduplication gate rejects or deduplicates
- Write with lifecycle `active` → supersede → original becomes `superseded`
- Revoke a record → audit trail preserves the revocation event
- Transfer a record across namespaces → provenance chain is appended

**Layer 2 (Trust) conformance tests** (planned):
- Write with `source_tier: llm_derived` → attempt to supersede with `source_tier: llm_derived` → Anti-Ouroboros gate rejects
- Write with `source_tier: human_confirmed` → supersede with `source_tier: llm_derived` → rejected
- Write with `source_tier: llm_derived` → supersede with `source_tier: human_confirmed` → allowed
- Transfer a record → TrustProof is preserved in the transferred record

**Layer 3 (Identity) conformance tests** (planned):
- Authenticate with valid credential → returns Principal
- Write to own namespace → allowed
- Write to foreign namespace without grant → rejected
- Grant permission → grantee can now write → revoke → grantee is blocked again

The test suite will be published as a standalone package (`aca-conformance-tests`) that any implementation can run against itself.

### Roadmap

| Phase | Deliverable | Timeline |
|---|---|---|
| **v0.1 Spec** | This document. Problem definition + layer architecture + evidence base. | June 2026 |
| **v1.0 Spec** | Formal specification of Layer 1 (Memory) + Layer 2 (Trust) + Layer 3 (Identity) interfaces. Conformance test suite published as standalone package. | Q3 2026 |
| **v1.0 Ref Impl** | AMH upgraded: TierGate interface, NamespaceACL, ProvenanceChain, conformance-passing reference implementation. | Q3 2026 |
| **Extension RFC: Authority** | Layer 4 specification. Role Manifest schema, Authority Ceiling, Delegation Chain, Escalation Policy interface, Mandatory Dissent protocol. | Q4 2026 |
| **Extension RFC: Decision** | Layer 5 specification. Decision Proposal, Consensus Result, Decision Lifecycle state machine. | Q1 2027 |
| **Extension RFC: Constitution** | Layer 6 specification. Knowledge Promotion, Amendment Process, Governance Decay Detection. Compatible with IETF Agent Audit Trail (draft-sharif-agent-audit-trail) log format. | Q2 2027 |
| **Second Conforming Impl** | Rust implementation passing the conformance test suite — independent of AMH codebase. | 2027 |
| **RFC Process** | Open RFC repository for community-proposed extensions and amendments. | Q3 2026 |

---

## 6. Why Now

Three conditions make this architecture timely:

**Multi-agent production failures are accumulating.** Memory pollution, circular knowledge, authority disputes, and unauditable decisions are reported with increasing frequency in production multi-agent systems. The pain is real and growing.

**The protocol layer is receptive.** MCP's rapid adoption (2024-2025) proved that developers will adopt open protocols over proprietary solutions when the protocol solves a real problem. The infrastructure for protocol-based agent systems exists; the governance protocol does not.

**Regulatory pressure is arriving.** The EU AI Act (2024/1689) requires that AI systems operating in high-risk domains be auditable, explainable, and subject to human oversight. No existing agent framework provides the governance infrastructure to meet these requirements at the organizational level. A protocol that makes governance auditable by design has structural regulatory advantage.

The window will not stay open. Platform vendors will eventually ship proprietary governance features. When they do, the question will be whether an open standard already exists — one that enterprises, developers, and regulators can point to as the neutral alternative.

---

## 7. Conclusion

The history of technology is a history of institutions catching up to tools.

We built railroads before we built railroad safety laws. We built the internet before we built internet governance. We built social networks before we understood their societal impact.

We are building AI agent systems now. Millions of agents will coordinate, share knowledge, make decisions, and form organizations. The question is not *whether* these organizations will need institutions — history shows they will. The question is *whether* those institutions will be open protocols that anyone can implement, or proprietary features locked inside platform vendors.

Agent Civilization Architecture is a bet on the former. It is a bet that the institutions of AI society should be as open as TCP/IP, as auditable as a blockchain, and as portable as a JSON file.

Memory Hall is where it starts. But memory is just the first institution. Trust, identity, authority, decisions, and constitutional governance will follow — because they always do.

---

## License

This document and the Agent Civilization Architecture specification are released under [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

## Citation

```bibtex
@techreport{chiba2026aca,
  title={Agent Civilization Architecture: An Infrastructure Protocol for AI Organizations},
  author={Chiba, Makito},
  year={2026},
  month={June},
  version={0.1},
  url={https://github.com/MakiDevelop/agent-memory-hall}
}
```
