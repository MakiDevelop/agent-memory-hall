# Next Session — Agent Memory Hall

> Last updated: 2026-06-15 (session 2)

## What's Done

- `@chibakuma/agent-memory-hall@0.4.0` live on npm
- MCP server: 5 tools (amh_write/read/transfer/audit/status)
- 4 store backends: SQLite (default) / PostgreSQL / JSON / Memhall
- Governance: source_tier + anti-Ouroboros + dedup + namespace isolation
- UMP / Mem0 import adapters
- Whitepaper v0.1 (5 chapters, 3600 words, 10 references)
- Blog published: blog.chibakuma.com/ump-defines-the-wire-amh-ships-the-governance-3/
- LinkedIn posted (中英雙版, humble tone)
- GitHub repo: public
- Short URLs: chiba.tw/amhblog, chiba.tw/amhgit, chiba.tw/amhnpm
- docker-compose.yml for multi-agent Postgres setup
- AMH MCP server added to ~/.claude/settings.json (dogfood ready)

## What's Next (priority order)

1. **Restart Claude Code** → AMH MCP server goes live, start dogfooding
2. **Dogfood for a week** → collect real bugs, real UX feedback
3. **Blog #2** → "I dogfooded my own memory protocol for a week"
4. **Show HN** → needs 30-second demo GIF first
5. **Letta MemFS import adapter** — high-overlap format, easy win
6. **LoCoMo benchmark** — Hindsight AMB framework, public judge prompt
7. **W3C CG decision** — join & contribute, or independent + cite?

## Key References

- Session 1 ACE: `~/Documents/agent-council/amp-whitepaper-20260615-094936/`
- Session 2 wrap-up: `~/Documents/agent-council/2026-06-15-agent-memory-hall-launch/`
- Max research ×2: `research/landscape-research-2026-06.md` + `research/ump-comparison-2026-06.md`
- memhall entries: `01KV4JZWVP8TETFA4TBN86CMZC` (session 1), `01KV4P8XANEZC4N1STBM9RBM4W` (session 2)
- memhall source: `~/GitHub/memory-hall/` (SQLite × 2, FastAPI, bge-m3, hybrid RRF)
