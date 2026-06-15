# UMP Defines the Wire. AMH Ships the Governance.

*Why I built Agent Memory Hall after running a 7-agent memory system for 60 sessions.*

---

Your AI agents can call tools. They can talk to each other. They can even present verifiable identities.

But ask them what they decided yesterday, and they stare at you blankly.

**Agent memory is broken.** Not because the storage is bad — Mem0, Zep, Letta, and a dozen others store memories just fine. It's broken because:

- Switch frameworks → lose all memories.
- Agent A decides something → Agent B doesn't know.
- An LLM summarizes its own summaries → hallucination amplification.
- Nobody knows who wrote a memory, when it expires, or who's allowed to delete it.

I ran into all four of these problems. And then I built the fix.

## The Setup

I run a 7-agent council: Claude, Codex, Gemini, Grok, gemma4, Perplexity Max, and SuperGrok. They collaborate on software architecture, code reviews, research, and strategic decisions. The system is called **memhall**, and it's been in production for two months.

Here's what I learned:

**1. Without deduplication, memory bloats in days.** Agents love to re-record things they already know. A content-hash check before every write cut our storage growth by 40%.

**2. LLM-derived memories are dangerous.** An LLM summarizes 10 observations into a "lesson learned." Next session, it retrieves that lesson and generates a *new* summary citing the *old* one. By session three, the memory has drifted from reality. I call this the **Ouroboros problem**. The fix: tag every memory with a `source_tier` (raw_source / llm_derived / human_confirmed) and block llm_derived → llm_derived chains.

**3. Namespace isolation is non-negotiable.** When seven agents share one memory store, you need walls. Agent A's working memory should not leak into Agent B's context. Namespace isolation is not a nice-to-have; it's what keeps multi-agent systems coherent.

**4. Every memory needs provenance.** "Who wrote this? When? Based on what evidence?" If you can't answer these questions, you can't trust the memory. And untrusted memory is worse than no memory — it's hallucination with a source citation.

## The Protocol

I turned these lessons into **Agent Memory Hall (AMH)** — an open interchange protocol for agent memory.

AMH is not a memory store. It's not a framework. It's not competing with Mem0 or Letta.

**AMH is a governance layer.** It defines how memory records are represented, transferred, expired, and audited. Any framework can implement it. Any store can back it.

The core: 14 fields, 4 operations, 4 governance defaults.

```bash
# One command to start
npx @chibakuma/agent-memory-hall
```

```json
// Add to your MCP config
{
  "mcpServers": {
    "agent-memory-hall": {
      "command": "npx",
      "args": ["@chibakuma/agent-memory-hall"]
    }
  }
}
```

Five MCP tools: `amh_write`, `amh_read`, `amh_transfer`, `amh_audit`, `amh_status`.

## How AMH Differs from UMP

Universal Memory Protocol (UMP) is the closest thing to what AMH does. It's well-designed — bi-temporal fields, W3C PROV alignment, conformance levels, multiple store adapters.

But UMP is a wire format. AMH is opinionated governance.

| | UMP | AMH |
|---|---|---|
| Focus | Format correctness | Operational governance |
| Type system | Cognitive (semantic/episodic/procedural) | Business (decision/fact/constraint/lesson/risk) |
| Governance | Optional (integrity at L3) | Default (dedup, anti-Ouroboros, namespace isolation) |
| Source trust | Provenance fields exist | **Enforced** — llm_derived chains are blocked |
| Origin | Spec-first | Operations-first (60 sessions of real multi-agent use) |

You can use both. AMH imports and exports UMP format. They're not competitors; they're different layers.

## What's Live Today

- **npm**: `@chibakuma/agent-memory-hall` v0.3.0
- **MCP server**: works with Claude Desktop, Cursor, Codex, any MCP host
- **3 store backends**:
  - **SQLite** (default) — single agent, zero config: `npx @chibakuma/agent-memory-hall`
  - **PostgreSQL** — multi-agent, concurrent access: `docker compose up -d`
  - **JSON** — lightest option, good for debugging
- **Import adapters**: UMP and Mem0
- **Governance**: dedup + anti-Ouroboros + namespace isolation + source-tier — all on by default
- **Whitepaper**: 5 chapters, 10 references, freely available

## What's Next

- Letta MemFS import adapter (July)
- LoCoMo benchmark with public judge prompt (August)
- Multi-agent dev team case study (September)
- v1.0 spec freeze + community RFC (October)

## Why I'm Sharing This

MCP standardized how agents use tools. A2A standardized how agents talk. Memory feels like the next piece that needs a shared approach.

There are already several projects working on this — UMP, various AMP variants, a new W3C community group. I don't know which approach will gain traction, but I think the governance side (dedup, provenance, lifecycle) is underexplored. AMH is my attempt to contribute what I've learned from running a real multi-agent memory system.

If you're working on something similar, I'd love to compare notes.

---

*Agent Memory Hall is Apache 2.0 licensed. GitHub: [MakiDevelop/agent-memory-hall](https://github.com/MakiDevelop/agent-memory-hall). npm: [@chibakuma/agent-memory-hall](https://www.npmjs.com/package/@chibakuma/agent-memory-hall).*
