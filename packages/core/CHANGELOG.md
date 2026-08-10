# Changelog

## 1.5.0 — 2026-08-10

### Fixed
- `--kind state` 不再把整段 content 複製進 `next:`。全庫體檢 419 筆發現 272 筆
  （有 `next:` 者的 98%）是整段重複，佔全庫 27% 字元且對 `amh boot` 零貢獻
  （boot 只讀 `next:` 第一行）。完整內文改為在欄位區之後保留一份。
- `--kind state` 不再於呼叫端已自帶 `[state …]` / `[wrap-up …]` 標頭時疊第二層
  `[state auto …]` prefix（體檢：216 / 419 筆，52%）。
- `blocker:` 不再寫死「無」。1.4.0 沒有正式 CLI 路徑可填 blocker，標準生成的欄位
  恆為「無」而被 `boot` 的過濾器濾掉；僅當呼叫端把 `blocker:` 夾在 multiline raw
  裡時才會非正式地被 `boot` 掃到。（Codex review 2026-08-10 Premise Challenge：
  早先「`open_blockers` 結構性永遠為空」的說法過強，已修正為此。）
- `--kind state` 的標頭偵測改為共用 `state-markers.ts`。先前版本匹配任意 `[...]`，
  但 `latest` 的 `isStateLike` 只認得固定幾種標頭，導致 `[memory …]` 這類內容
  既不補 `[state auto]`、也不被 `latest` 視為 state 而遭 preference filter 排除。
- `--next` / `--blocker` / `--status-label` / `--artifact` 現在拒絕含換行的值。
  先前只做 `trim()`，`--next "a\nblocker: x"` 會產生第二個 `blocker:` 行並被
  `boot` 當成真實 blocker。改為 fail-loud，不靜默替換。
- `kind=state` 的 body 不再被 `trim()` 吃掉第一層縮排（會破壞 markdown code block
  與 YAML）；改為僅用於判空，並正規化 CRLF。

### Added
- `amh write --next <text>` — 明確指定 `kind=state` 的下一步。
  預設取 content 第一行去標頭；標頭無正文時退到 body 第一個非空行；
  兩者皆空則報錯。此預設是**相容性 fallback**，不保證第一行語意上真的是下一步，
  建議呼叫端明確傳 `--next`。
- `amh write --blocker <text>` — 明確指定 `kind=state` 的阻塞（預設「無」）
- `src/state-markers.ts` — state 標頭清單的單一事實來源，`latest.isStateLike`
  與 write formatter 共用，避免兩套判斷漂移。

### Changed
- `formatWriteContent` 由 `cli.ts` 抽出至 `src/write-format.ts` 並 export，
  補 25 條單元測試（`cli.ts` 有 top-level dispatch，無法直接 import 測試）。
- `pointer` / `memory` 分支輸出與 1.4.0 相同（皆有測試鎖定）。

## 1.4.0 — 2026-07-24

### Added
- `amh boot` — session compiler (latest + blockers + artifact exists + protocol hints)
- `amh knowledge` / `knowledge list` — durable fact/constraint with supersede
- `amh write --supersedes` / `--ttl-days` / `--valid-until`
- `amh ttl-sweep [--apply]` — expire past `valid_until` (default dry-run)

## 1.3.0 — 2026-07-24

### Added
- `amh latest --ns …` — chronological handoff resume (R4); MCP tool `amh_latest`
- Write content quality gate: reject placeholders (`test`), require artifact path for `[pointer …]`, warn long `[state …]`
- `--kind state|memory|pointer`, `--status-label`, `--artifact` on `amh write`
- Memhall store: no-text query uses `GET /v1/memory` (list) instead of hybrid search
- `amh status` reports store type/path/reachable + handoff rule

### Fixed
- Handoff load no longer uses relevance search on memhall backend

## 0.6.5 — 2026-06-15

### Added (`integration:memhall-amh` Phase 3)
- `MemhallStore.findByContentHash` uses `GET /v1/memory/by-amh-hash`
- Live contract test `memhall-contract.integration.test.ts` + CI job `integration-memhall.yml`

## 0.6.4 — 2026-06-15

### Added (`integration:memhall-amh` Phase 2)
- `AmhStore.linkSupersedes()`; `MemhallStore` calls `POST /v1/memory/{child}/link`
- Supersede order: parent PATCH → child write → link edge → audit

## 0.6.3 — 2026-06-15

### Added (`integration:memhall-amh`)
- `AmhStore.patchMetadata()` optional method; `MemhallStore` calls `PATCH /v1/memory/{id}`
- `metadata.amh_content_hash` (BLAKE3) on memhall writes

### Fixed (`integration:memhall-amh`)
- `MemhallStore.put` adopts server `entry_id` (ULID); `writeMemory` returns canonical id
- `revokeMemory` / supersede use metadata PATCH on memhall backend (revoke no longer lost on content dedup)

## 0.6.2 — 2026-06-15

### Added
- CLI `amh export --to ump --out <file> [--ns <namespace>]`

### Fixed
- Memhall store persists `amh_status` in metadata on write/read (revoke sync)
- `amh_read` returns JSON `{ error: "not_found" }` instead of plain text

### Changed
- Docs synced: NEXT_SESSION, ARCHITECTURE, whitepaper (6 tools)

## 0.6.1 — 2026-06-15

### Fixed
- `dist/cli.js` executable bit set in build (`chmod +x`) — fixes workspace `Permission denied` on bin symlink
- CLI `--version` / `-v` flag

## 0.6.0 — 2026-06-15

### Added
- `revokeMemory()` — soft-delete via `status: revoked` + audit trail
- MCP tool `amh_forget` (6th tool)
- CLI `amh forget` and `amh transfer`
- Memhall store audit persistence via `~/.amh/memhall-audit-{hash}.json` sidecar
- MCP stdio end-to-end test (write → read → forget → audit)

### Changed
- Default reads now hide `revoked` and `superseded` records (use `filterInactive: false` for audit/admin)
- `amh_audit` reads inactive records so revoked memory audit trails remain accessible

## 0.5.3 — 2026-06-15

- Version bump for npm republish after 0.5.2

## 0.5.2 — 2026-06-15

- Full npm-facing README with GitHub absolute URLs

## 0.5.1 — 2026-06-15

- Publish hygiene: `tsconfig.build.json` excludes tests, `verify-pack` CI check

## 0.5.0 — 2026-06-15

- Governance hardening: trusted caller, supersede auth, write-gate config, transfer semantics