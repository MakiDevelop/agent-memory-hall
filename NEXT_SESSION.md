# Next Session — Agent Memory Hall

> Last updated: 2026-06-15 (ACA v0.1 + AMH v0.7.0 schema foundation)

## Immediate (v0.7.0 → v1.0)

1. **npm publish 0.7.0** — `cd packages/core && npm publish --access public`（需 OTP）
2. **SQLite `patchTier` 實作** — 三兄弟一致指出缺失，目前 tier-upgrade 在 SQLite store 會 throw
3. **MCP `amh_tier_upgrade` tool** — agent 無法透過 MCP 觸發 tier upgrade
4. **CLI `tier-upgrade` command** — 對齊其他 CLI commands
5. **`TrustProofSchema.parse` 完整驗證** — 目前只檢查 confirmed_by/confirmed_at
6. **tier-upgrade 單元測試** — 目前 0 test coverage

## Migration (Breaking Changes in v0.7.0)

- `content_hash` 算法變更：`hash(value)` → `hash(format:value)` — 既有 DB dedup index 需 rehash
- `memory_type: "decision"` 移除 — SQLite/Postgres 舊 records 讀取可能 Zod fail
- `AuditEvent.agent_id` → `principal_id` — DB column 仍叫 agent_id，adapter 做 mapping

## Dogfooding 影響

- `~/.amh/memory.db` — 既有 records 的 content_hash 跟新算法不一致
- `.amh/handoff.json` — 仍可讀取（backward compat），新寫入用新 hash
- MCP server 重啟後用新版 — 舊 decision type records 需手動改 fact

## ACA Reference Implementation

本 repo 是 Agent Civilization Architecture (ACA) 的 Layer 1-2 reference implementation。
ACA spec: https://github.com/MakiDevelop/agent-civilization-architecture
