# Agent Memory Hall

> **Your AI coding agent forgets everything the moment you close the session.**
> AMH fixes that — with a handoff protocol, not another vector database.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![MCP](https://img.shields.io/badge/MCP-native-blue)](https://modelcontextprotocol.io)

---

## The Problem

Every developer who uses AI coding agents knows this ritual:

1. Work with Claude Code / Cursor / Copilot for two hours
2. Close the session
3. Open a new session — the agent has **no idea what you were doing**
4. Spend 10 minutes re-explaining the context
5. Repeat

Worse: the agent said *"I'll fix the auth bug next session."* It didn't. Because it forgot it promised.

**Existing memory tools solve storage** ("where do I put memories?"). AMH solves **continuity** ("did the agent actually follow through?").

---

## What AMH Does

Three slash commands. One local SQLite file. Three minutes to set up.

```
/start    → reads last session's state, shows "here's where you left off"
/save     → checkpoint mid-session (after a milestone)
/wrap-up  → structured close: what was done, what's pending, what's next
```

Plus **Baton** — the part no other tool does:

```
Baton tracks:
  - open_loops:      "said I'd do X — haven't done it yet"
  - follow_ups:      "deferred 3 times, first seen June 10"
  - active_decisions: "chose A over B because..."
  - patterns:        "keeps making the same mistake"
```

When you `/start` the next session, Baton tells your agent: *"You promised to fix the auth bug. You haven't. It's been deferred twice."*

---

## Quick Start (3 minutes)

### Option A: SQLite Skills (zero dependencies)

**macOS:**
```bash
mkdir -p ~/.claude/skills/{session-start,session-save,session-wrap-up} ~/.claude/job-memo
python3 -c "
import sqlite3, os
db = os.path.expanduser('~/.claude/sessions.db')
conn = sqlite3.connect(db)
conn.execute('''CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT DEFAULT (datetime(\"now\", \"localtime\")),
    slug TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT \"episode\",
    content TEXT NOT NULL,
    tags TEXT DEFAULT \"\"
)''')
conn.commit(); conn.close()
print(f'Done: {db}')
"
```

Then copy the three SKILL.md files → [macOS Guide](https://chiba.tw/memory-hall/guides/session-skills-macos.html) | [Windows Guide](https://chiba.tw/memory-hall/guides/session-skills-windows.html)

### Option B: MCP Server (one line)

```bash
npx @chibakuma/agent-memory-hall
```

Add to your MCP client (Claude Desktop / Cursor / Cline):

```json
{
  "mcpServers": {
    "agent-memory-hall": {
      "command": "npx",
      "args": ["@chibakuma/agent-memory-hall"]
    }
  }
}
```

---

## When You Outgrow SQLite → memory-hall Server

The SQLite entry point is enough for solo developers. When you need more:

| Need | Solution |
|------|----------|
| Semantic search ("find sessions about auth refactor") | **[memory-hall](https://github.com/MakiDevelop/memory-hall)** server — BM25 + vector hybrid |
| Multi-device sync | memory-hall server on your LAN or cloud |
| Team sharing | memory-hall's team-memhall namespace |
| CJK-native tokenization | memory-hall's jieba-based FTS5 |
| Baton with CAS locking | memory-hall's Baton Store API |

```bash
# Upgrade: one Docker command
git clone https://github.com/MakiDevelop/memory-hall
cd memory-hall && docker compose up -d
# Then point AMH to the server
```

The format is compatible — SQLite sessions import directly into memory-hall.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  agent-memory-hall (this repo)                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Session Handoff Protocol                  │  │
│  │  /start → /save → /wrap-up               │  │
│  │  + Baton (open loops, follow-ups,         │  │
│  │    decisions, patterns)                   │  │
│  └───────────────────────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────────────┐     │
│  │ MCP Server   │  │ SQLite Skills        │     │
│  │ (npx)        │  │ (SKILL.md, 0 deps)   │     │
│  └──────┬───────┘  └──────────────────────┘     │
│         │                                       │
│         ▼                                       │
│  ┌──────────────────────────────────────────┐   │
│  │ Storage: local SQLite (default)          │   │
│  │    or → memory-hall server (upgrade)     │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
         │ optional
         ▼
┌─────────────────────────────────────────────────┐
│  memory-hall (separate repo)                    │
│  Hybrid search · Multi-device · Team sharing    │
│  CJK-native · Baton Store · HTTP/CLI/Python     │
│  github.com/MakiDevelop/memory-hall             │
└─────────────────────────────────────────────────┘
```

## Two Repos, Clear Boundary

| | agent-memory-hall (this repo) | [memory-hall](https://github.com/MakiDevelop/memory-hall) |
|---|---|---|
| **What** | Protocol + client + skills | Server engine |
| **Solves** | "How do sessions hand off?" | "Where do memories live at scale?" |
| **Storage** | Local SQLite (built-in) | SQLite + vector + hybrid search |
| **Runs on** | Your dev machine | Mac mini / Docker / cloud |
| **Required?** | Yes (entry point) | No (upgrade when needed) |
| **MCP** | Native (primary interface) | HTTP API (AMH connects to it) |

---

## Built-in Governance

AMH doesn't just store memories — it tracks **who wrote it, where it came from, and whether it's trustworthy**.

| Feature | What it does |
|---------|-------------|
| **source_tier** | `raw_source` / `llm_derived` / `human_confirmed` — trust level |
| **trust_proof** | Evidence-based verification for tier upgrades |
| **provenance_chain** | Full derivation history |
| **content_hash dedup** | BLAKE3 hash rejects duplicates |
| **namespace isolation** | Scoped read/write per project |
| **audit trail** | Immutable append-only log |

## Packages

| Package | Description |
|---------|-------------|
| [`@chibakuma/agent-memory-hall`](packages/core) | Core protocol + MCP server + CLI |
| [`@chibakuma/aca-inspector`](packages/inspector) | Web UI for memory governance |
| [`@chibakuma/aca-langgraph`](packages/langraph) | LangGraph.js checkpointer integration |
| [`@chibakuma/aca-incident-analyzer`](packages/incident-analyzer) | Governance linter (8 rules) |
| [`@chibakuma/aca-certification`](packages/certification) | Conformance test suite (5 layers) |

## What AMH Is Not

- **Not a vector database.** Use Pinecone / Chroma / Qdrant for that.
- **Not a universal memory framework.** Use Mem0 / Cognee / Letta if you need one.
- **Not a replacement for CLAUDE.md.** AMH complements file-based context injection.
- **AMH solves continuity** — ensuring nothing gets dropped between sessions.

---

## Docs

- [Tutorial: Why Your AI Assistant Needs Session Memory](https://chiba.tw/memory-hall/tutorial-why-session-memory.html)
- [macOS Setup Guide](https://chiba.tw/memory-hall/guides/session-skills-macos.html)
- [Windows Setup Guide](https://chiba.tw/memory-hall/guides/session-skills-windows.html)
- [Full Protocol Spec](docs/Agent_Civilization_Architecture.md)

## License

Apache 2.0 — by [Cypher Lockhart](https://github.com/MakiDevelop) (江中喬 / 千葉牧人)
