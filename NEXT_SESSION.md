# Next Session — Agent Memory Hall

> Last updated: 2026-06-15 (session 3)

## What's Done

- `@chibakuma/agent-memory-hall@0.6.2` live on npm (pending publish)
- MCP server: 6 tools (amh_write/read/transfer/forget/audit/status)
- CLI: write, read, import, export (UMP), transfer, forget, audit, status
- v0.6: selective forget (revoke), lifecycle hides revoked/superseded, memhall audit sidecar
- 4 store backends: SQLite (default) / PostgreSQL / JSON / Memhall
- Governance: source_tier + anti-Ouroboros + dedup + namespace isolation
- UMP / Mem0 import adapters
- 41 tests including MCP stdio e2e

## What's Next (priority order)

1. **Dogfood for a week** → collect real bugs, real UX feedback
2. **Blog #2** → "I dogfooded my own memory protocol for a week"
3. **Show HN** → needs 30-second demo GIF first
4. **Letta MemFS import adapter** — high-overlap format, easy win
5. **LoCoMo benchmark** — Hindsight AMB framework, public judge prompt
6. **W3C CG decision** — join & contribute, or independent + cite?

## Key References

- GitHub: https://github.com/MakiDevelop/agent-memory-hall
- npm: `@chibakuma/agent-memory-hall`
- Codex handoff: `packages/core/docs/codex-handoff.md`