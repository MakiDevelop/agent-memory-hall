# AMH ↔ memory-hall Integration

This document is the **shared contract** between two repos that evolve together but stay separate:

| Repo | Role | Package |
|------|------|---------|
| [agent-memory-hall](https://github.com/MakiDevelop/agent-memory-hall) | Interchange + governance protocol | `@chibakuma/agent-memory-hall` (npm) |
| [memory-hall](https://github.com/MakiDevelop/memory-hall) | Storage + hybrid search engine | Python, `:9100` HTTP |

**Rule:** AMH does not become a vector DB. memory-hall does not become a governance platform. They meet at a thin **adapter contract**.

Mirror doc: [memory-hall/docs/INTEGRATION.md](https://github.com/MakiDevelop/memory-hall/blob/main/docs/INTEGRATION.md)

---

## Stack (target)

```
Agents (Claude / Codex / Gemini / Grok / …)
    │
    ▼
AMH  — schema, write-gate, namespace isolation, revoke, audit, MCP
    │
    ├── sqlite / json / postgres   ← single-agent, zero-deps dogfood
    │
    └── memhall adapter  ──HTTP──►  memory-hall  (hybrid search, CJK FTS, embeddings)
```

**When to use which store**

| Scenario | Store | Why |
|----------|-------|-----|
| Codex sandbox, no TCP | `sqlite` or `json` | No bearer token, no network |
| Multi-agent shared + semantic search | `--store memhall --path http://host:9100` | Engine handles embed + hybrid |
| Production governance + Postgres | `postgres` | AMH-native, no memhall dependency |
| Session handoff files | `~/Documents/amh-handoff/` + sqlite | Human-readable + AMH audit |

Dogfooding default for agents: **local `amh` (sqlite)**. memhall is the **scale-up backend**, not the only path.

---

## Responsibility split

| Concern | Owner |
|---------|--------|
| Record schema (`memory_id`, `status`, `source_tier`, …) | AMH |
| Write-gate, anti-Ouroboros, namespace ACL | AMH |
| Revoke / supersede lifecycle | AMH (status + audit) |
| BLAKE3 `content_hash` (governance dedup) | AMH |
| Persist bytes, FTS5, sqlite-vec, embed queue | memory-hall |
| `sha256:` content dedup (insert-level) | memory-hall |
| Hybrid / lexical / semantic search | memory-hall |
| CJK jieba tokenization | memory-hall |
| Bearer auth shim (`MH_API_TOKEN`) | memory-hall |

memory-hall **metadata** is the bridge field: AMH maps protocol fields into `metadata.*` on write.

---

## Adapter field mapping (today)

| AMH field | memory-hall field |
|-----------|-------------------|
| `memory_id` | `entry_id` (intended; see gaps) |
| `agent_id` | `agent_id` |
| `namespace` | `namespace` |
| `memory_type` | `type` (`lesson` → `episode`, others 1:1) |
| `content.value` | `content` |
| `source.*` | `metadata.source_type`, `source_ref`, `source_tier` |
| `status` | `metadata.amh_status` |
| `valid_until` | `metadata.valid_until` |
| `supersedes` | `metadata.supersedes` (+ `POST …/link` intended) |
| `content_hash` (BLAKE3) | not stored; engine uses `sha256:` of content |

Tags: AMH writes `tags: ["amh"]` for filtering.

---

## Known gaps

Track fixes in paired releases tagged `integration:memhall-amh`.

### P0 — ID drift — **fixed in AMH 0.6.3 + memory-hall PATCH**

- AMH `writeMemory` assigns a **UUID** `memory_id` and returns it to the caller.
- `MemhallStore.put` sends `entry_id` in the JSON body, but memory-hall `WriteMemoryRequest` has **no `entry_id` field** — server always allocates a **ULID**.
- `MemhallStore.put` **does not read** `WriteMemoryResponse.entry_id`.
- Result: CLI/MCP return a UUID that `GET /v1/memory/{id}` cannot resolve.

**Shipped:** `MemhallStore.put` adopts `response.entry_id`; `writeMemory` returns `record.memory_id`.

### P0 — Revoke does not stick on dedup — **fixed in AMH 0.6.3 + memory-hall PATCH**

- `revokeMemory` calls `store.put` with same `content`, `metadata.amh_status: revoked`.
- memory-hall dedup is `(tenant_id, content_hash)` on **content only**. Duplicate insert returns existing row **without merging metadata**.
- Revoke appears to succeed in AMH but memhall row stays `amh_status: active`.

**Shipped:** `PATCH /v1/memory/{entry_id}` shallow-merge; AMH `revokeMemory` / supersede call `patchMetadata`.

### P1 — Hash namespace mismatch — **fixed in AMH 0.6.5**

- AMH dedup: BLAKE3 via `findByContentHash` → `GET /v1/memory/by-amh-hash`
- memory-hall insert dedup: `sha256:` content hash (unchanged)
- `metadata.amh_content_hash` written on every AMH memhall put

### P1 — Supersedes not linked — **fixed in AMH 0.6.4**

**Shipped:** Child write → parent PATCH → `linkSupersedes(child, parent)` → audit (child-first for atomicity).

### P2 — Audit split

- AMH audit: local sidecar `~/.amh/memhall-audit-{hash}.json`.
- memory-hall: `GET /v1/events` (planned / gateway); not wired to AMH audit.

**Fix:** Append AMH audit events to sidecar (keep) **and** optional `metadata.amh_audit` tail or gateway events stream. Do not duplicate full audit in SQLite row.

---

## Paired release checklist

Run monthly or before any `MemhallStore` behavior change:

- [ ] AMH `MemhallStore.put` uses server `entry_id`
- [ ] Revoke round-trip: write → forget → read with `filterInactive: false` shows `revoked` on memhall backend
- [ ] Supersede: parent hidden on default read, link edge exists in engine
- [ ] Search: `amh read --text` against memhall returns same namespace rows as sqlite export
- [ ] Docs: both `docs/INTEGRATION.md` updated
- [ ] Changelog: both repos note `integration:memhall-amh`

---

## Phase plan (minimal, no merge)

### Phase 1 — Contract + P0 fixes

1. This document in both repos.
2. memory-hall: metadata merge on dedup **or** `PATCH` metadata.
3. AMH: capture `entry_id` from write response; memhall-specific revoke update.

### Phase 2 — Graph + search parity

1. Wire supersede → `/link`.
2. `amh read --text "…"` documented as memhall hybrid search path.
3. Store `metadata.amh_content_hash` for cross-hash dedup visibility.

### Phase 3 — CI contract test — **shipped (0.6.5)**

1. `integration-memhall.yml` on `main`: contract server + pytest + AMH `test:contract`
2. PRs: mocked unit tests only (fast). Engine `amh_status` filter **deferred** (AMH read layer).

**Out of scope:** merging repos, putting write-gate inside memory-hall, or making memhall HTTP mandatory for agents.

---

## Agent operations (Maki home lab)

| Agent | Primary path | Handoff |
|-------|--------------|---------|
| Claude | `amh` MCP / sqlite | `~/Documents/amh-handoff/claude.md` |
| Codex | `amh` CLI sqlite | `codex-handoff.md`, no raw memhall HTTP |
| Gemini | `amh` | deprecated: direct memhall HTTP |
| Grok / Gemma4 | `amh` | `amh-handoff/grok.md`, `gemma4-ollama.md` |

Shared facts: `amh-handoff/SHARED.md`. Project namespace: `project:agent-memory-hall`.

### Maki home lab topology

| Role | Host | URL |
|------|------|-----|
| Primary | Mac mini M4 #2 | `http://100.89.41.50:9100` |
| Standby | Mac mini M4 #1 | `http://100.122.171.74:9100` |

Agents use **primary** unless failover. Always via AMH adapter, not raw HTTP.

```bash
export MH_API_TOKEN="$(cat ~/.config/memhall/token)"
amh --store memhall --path http://100.89.41.50:9100 \
  --caller-ns project:agent-memory-hall \
  write --agent claude --ns project:agent-memory-hall --type fact "…"
```

---

## Related links

- [ARCHITECTURE.md](../packages/core/ARCHITECTURE.md) — AMH modules
- [codex-handoff.md](../packages/core/docs/codex-handoff.md) — sandbox dogfood
- [memory-hall agent-integration.md](https://github.com/MakiDevelop/memory-hall/blob/main/docs/agent-integration.md) — HTTP vs embedded vs CLI
- [memory-hall ADR 0003](https://github.com/MakiDevelop/memory-hall/blob/main/docs/adr/0003-engine-library-vs-deployment-platform.md) — engine vs platform