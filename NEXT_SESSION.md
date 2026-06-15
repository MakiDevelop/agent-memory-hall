# Next Session — Agent Memory Hall

> Last updated: 2026-06-15 (AMH ↔ memory-hall integration complete)

## What's Done

### AMH (`@chibakuma/agent-memory-hall`)
- **v0.6.5** local (`npm link`); GitHub `main` @ `27e5c8e`
- npm registry still **0.6.2** — `npm publish --otp=XXXXXX` pending
- Phases 1–3: MemhallStore (ULID adopt, PATCH revoke/supersede, link, by-amh-hash dedup)
- 44 unit tests + live contract test (`npm run test:contract`)
- CI: `integration-memhall.yml` on `main` push

### memory-hall (engine)
- GitHub `main` @ `c5c3da7` (PATCH, link, hash lookup, metadata allowlist)
- `docs/INTEGRATION.md` mirrors AMH repo

### Home lab deployment (2026-06-15)

| Role | Host | URL | Image |
|------|------|-----|-------|
| **Primary** | Mac mini M4 **#2** | `http://100.89.41.50:9100` | `memory-hall:0.1.0` |
| **Standby** | Mac mini M4 **#1** | `http://100.122.171.74:9100` | `memory-hall:0.1.0` |

Deploy method: build image on MBP → `docker save | ssh mini docker load` → `compose up --force-recreate` (SSH docker build blocked by keychain).

Data: `/Users/maki/data/memory-hall` on both minis (unchanged).

### Agent ops
- Handoff SOP: `~/Documents/amh-handoff/SHARED.md` (topology + store rules)
- All agents: `amh --store memhall --path http://100.89.41.50:9100` (not raw HTTP)
- Codex sandbox: `--store json` per `codex-handoff.md`

## What's Next

1. **npm publish 0.6.5** — `npm publish --otp=...` from `packages/core`
2. **Dogfood a week** — bugs/UX via `amh` only
3. **Backup failover drill** — optional: verify switch to `100.122.171.74:9100`
4. Blog / Show HN / LoCoMo — unchanged from prior backlog

## Key References

- Integration contract: `docs/INTEGRATION.md` (both repos)
- GitHub: https://github.com/MakiDevelop/agent-memory-hall
- Engine: https://github.com/MakiDevelop/memory-hall
- npm: `@chibakuma/agent-memory-hall`