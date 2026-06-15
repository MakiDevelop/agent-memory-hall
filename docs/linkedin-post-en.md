# LinkedIn Post (English)

---

I spent two months running a 7-agent AI team on a shared memory system.

Then I turned the lessons into an open protocol.

---

The problem with AI agent memory isn't storage — Mem0, Zep, and Letta store memories fine.

The problem is governance:

→ Switch frameworks = lose all memories
→ Agent A decides something, Agent B has no idea
→ An LLM summarizes its own summaries, drifting from reality in 3 cycles (I call this the Ouroboros problem)
→ Nobody knows who wrote a memory, when it expires, or who can delete it

I hit all four running a 7-agent council (Claude, Codex, Gemini, Grok, gemma4, Perplexity Max, SuperGrok) across 60+ sessions on my self-built memory system.

Four hard-earned lessons:

1️⃣ Without dedup, memory bloats in days. Content-hash checks cut storage growth 40%.

2️⃣ LLM-derived memories are dangerous. Tag every memory with a source_tier (raw_source / llm_derived / human_confirmed). Block llm_derived → llm_derived chains.

3️⃣ Namespace isolation is non-negotiable. Seven agents sharing one store without walls = disaster.

4️⃣ Every memory needs provenance. "Who wrote this? When? Based on what?" Untrusted memory is worse than no memory — it's hallucination with a citation.

---

So I built Agent Memory Hall (AMH) — an open interchange protocol for agent memory governance.

AMH is not a memory store. Not a framework. Not competing with Mem0 or Letta.

AMH is a governance layer: how memories are written, transferred, expired, and audited.

14 fields. 4 operations. 4 governance defaults — all on from day one.

One command to start:
npx @chibakuma/agent-memory-hall

Works with Claude Desktop, Cursor, Codex — any MCP host.

---

How it differs from UMP (Universal Memory Protocol):

UMP defines the format. AMH ships the governance.

UMP's governance is optional (integrity at L3). AMH's is default — because we learned that ungoverned memory degrades to noise within weeks.

They're not competitors. AMH imports/exports UMP format. Different layers.

---

Live today:
✅ npm: @chibakuma/agent-memory-hall v0.1.0
✅ MCP server (5 tools)
✅ UMP & Mem0 import adapters
✅ Whitepaper (5 chapters, 10 references)
✅ GitHub: github.com/MakiDevelop/agent-memory-hall

What's next:
→ SQLite adapter (July)
→ LoCoMo benchmark with public judge prompt (August)
→ Multi-agent dev team case study (September)
→ v1.0 spec freeze + community RFC (October)

---

MCP standardized how agents use tools.
A2A standardized how agents talk.
Someone needs to standardize how agents remember.

I'm betting the winner won't be the most theoretically complete spec. It'll be the one that ships governance by default.

The code is open. The spec is free. The memories are yours.

Full blog post: https://blog.chibakuma.com/ump-defines-the-wire-amh-ships-the-governance/

#AIAgent #AgentMemory #MCP #OpenSource #AgentMemoryHall #MultiAgent #LLM

