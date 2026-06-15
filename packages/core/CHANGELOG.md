# Changelog

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