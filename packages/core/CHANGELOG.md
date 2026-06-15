# Changelog

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