# LinkedIn Post (English)

---

I've been experimenting with shared memory for multi-agent AI systems. Learned some things the hard way — sharing in case it's useful.

---

AI agents today can call tools (MCP), talk to each other (A2A), and verify identities (DID). But there's a basic problem that's still unsolved: how agents remember.

Switch frameworks, and memories are gone. Agent A makes a decision, Agent B has no idea. An LLM summarizes its own summaries, drifting from reality in a few cycles. Nobody knows who wrote a memory, when it should expire, or who's allowed to delete it.

---

Some context: over the past two months, I've been running a multi-agent team (Claude, Codex, Gemini, and others) on a self-built memory system called memhall — about 60 collaborative sessions so far.

A few lessons that might help others working on multi-agent systems:

1️⃣ Without dedup, memory bloats fast. Agents tend to re-record things they already know. Content-hash checks before every write helped a lot.

2️⃣ LLM-derived memories need careful handling. The LLM takes last session's summary as fact and generates a new summary on top of it. After a few rounds, it's drifted from the original evidence. Our fix: tag every memory with a source_tier (raw_source / llm_derived / human_confirmed) and block llm_derived-to-llm_derived chains.

3️⃣ Namespace isolation matters more than you'd think. Multiple agents sharing one memory store without walls leads to context leakage.

4️⃣ Every memory needs provenance. "Who wrote this? When? Based on what?" If you can't answer these, the memory isn't trustworthy.

---

I've packaged these governance patterns into Agent Memory Hall (AMH) — an open-source governance layer for agent memory.

It's not a memory store and it's not trying to replace Mem0 or Letta. It's more of a governance layer: defining how memories are written, transferred, expired, and audited. Any framework can plug in.

It's at v0.3 now — still early, but usable:

Single agent (zero config):
npx @chibakuma/agent-memory-hall
→ SQLite at ~/.amh/memory.db, works out of the box

Multi-agent (Docker + Postgres):
docker compose up -d
npx @chibakuma/agent-memory-hall --store postgres --path postgres://amh:amh@localhost:5432/amh

It's MCP-native — works with Claude Desktop, Cursor, and any MCP host.

---

Compared to UMP (Universal Memory Protocol), which focuses on format definition, AMH focuses on governance defaults — dedup, source-tier tracking, namespace isolation are all on by default. The two are compatible; AMH can import/export UMP format.

---

Still very early stage. If you're building multi-agent systems and have run into memory issues, I'd love to hear your experience:

📝 Blog (technical details): chiba.tw/amhblog
💻 GitHub: chiba.tw/amhgit
📦 npm: chiba.tw/amhnpm

#AIAgent #AgentMemory #MCP #OpenSource #MultiAgent #LLM
