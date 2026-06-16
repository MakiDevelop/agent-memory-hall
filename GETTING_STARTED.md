# Getting Started with ACA & Agent Memory Hall

> 從零開始理解 Agent Civilization Architecture，30 分鐘內掌握核心概念並跑起第一個 demo。

---

## 閱讀順序

### Step 1：理解問題（10 分鐘）

**先讀 Anti-Ouroboros，不要先讀 spec。**

- [`docs/Anti_Ouroboros_Evidence.md`](docs/Anti_Ouroboros_Evidence.md) — LLM 覆蓋 LLM 產出時會發生什麼？13 篇獨立來源、三大失敗模式（Model Collapse / Knowledge Amplification / Memory Poisoning）的真實案例與量化數據。

讀完你會知道：為什麼 AI agent 的記憶需要治理，而不只是「存起來就好」。

### Step 2：理解解法（20 分鐘）

- [`README.md`](README.md) — 專案入口，AMH 是什麼、不是什麼、核心 schema、Quick Start
- [`docs/Agent_Civilization_Architecture.md`](docs/Agent_Civilization_Architecture.md) — ACA 完整規格：五層架構（Memory → Trust → Identity → Authority → Decision）與每層職責

讀完你會知道：ACA 用什麼結構解決 agent 組織治理的問題。

### Step 3：動手跑（15 分鐘）

```bash
# 安裝
npm install -g @chibakuma/agent-memory-hall

# 或直接用 npx
npx @chibakuma/agent-memory-hall status

# 寫一條記憶
npx @chibakuma/agent-memory-hall write \
  --agent my-agent \
  --ns project:demo \
  --type fact \
  "PostgreSQL is the primary database. Rationale: team expertise."

# 讀回來
npx @chibakuma/agent-memory-hall read --ns project:demo

# 接進 MCP client（Claude Desktop / Cursor / Codex）
# 在 MCP config 中加入：
# {
#   "mcpServers": {
#     "agent-memory-hall": {
#       "command": "npx",
#       "args": ["@chibakuma/agent-memory-hall"]
#     }
#   }
# }
```

### Step 4：深入理解（選讀）

| 文件 | 內容 | 適合誰 |
|------|------|--------|
| [`docs/Agent_Civilization_Theory.md`](docs/Agent_Civilization_Theory.md) | 理論基礎 — 為什麼把人類文明發展的結構套用到 agent | 想理解設計哲學的人 |
| [`docs/whitepaper.md`](docs/whitepaper.md) | 學術角度的完整論述 | 寫論文、做 review 的人 |
| [`packages/core/README.md`](packages/core/README.md) | 完整 API 參考、CLI 指令、Store 後端、Identity Layer | 要整合進自己系統的開發者 |
| [`docs/Evidence_Catalog.md`](docs/Evidence_Catalog.md) | 所有 evidence 的結構化索引 | 需要引用資料的人 |
| [`docs/INTEGRATION.md`](docs/INTEGRATION.md) | memory-hall 後端整合契約 | 要接 PostgreSQL / memhall store 的人 |

---

## 核心概念速查

### Anti-Ouroboros Rule

> LLM-derived knowledge MUST NOT supersede LLM-derived knowledge without human intervention.

這是 ACA 最核心的治理規則。沒有這條規則，agent 之間會形成「知識回音室」— Agent A 的幻覺變成 Agent B 的事實，再回頭強化 Agent A 的錯誤信念。

### Source Tier（三級信任）

| Tier | 意義 | 範例 |
|------|------|------|
| `raw_source` | 未驗證的原始輸入 | 使用者貼的連結、外部 API 回傳 |
| `llm_derived` | AI 生成的推論 | Agent 的分析結論、摘要 |
| `human_confirmed` | 人類確認過的知識 | 經 review 後升級的決策 |

信任只能往上升（`raw_source` → `llm_derived` → `human_confirmed`），不能降級。`llm_derived` 不能覆蓋 `llm_derived`，必須經過人類確認。

### Five Layers

```
Layer 5: Decision    — 組織如何做決策？
Layer 4: Authority   — 誰有權決定？
Layer 3: Identity    — 誰屬於這個組織？誰能做什麼？
Layer 2: Trust       — 組織相信什麼？（Anti-Ouroboros 在這層）
Layer 1: Memory      — 組織記得什麼？
```

每一層解決一個人類文明也曾面對的問題。AMH 目前實作了 Layer 1-3。

---

## ACA Ecosystem

| Package | 用途 | npm |
|---------|------|-----|
| [ACA Spec](https://github.com/MakiDevelop/agent-civilization-architecture) | 協定規格（5 層 + 治理面 + 34 conformance tests） | — |
| **Agent Memory Hall**（本 repo） | ACA Layer 1-3 的 reference implementation | `@chibakuma/agent-memory-hall` |
| [aca-govern](https://github.com/MakiDevelop/aca-govern) | MCP 治理代理 — 為任何 MCP server 加上 audit + policy | `@chibakuma/aca-govern` |
| [aca-types](https://github.com/MakiDevelop/aca-types) | ACA 協定的 TypeScript 型別定義 | `@chibakuma/aca-types` |

---

## FAQ

**Q: AMH 跟 Mem0 / Zep / Letta 有什麼不同？**

AMH 不取代你的 vector database。Mem0/Zep/Letta 解決「怎麼存」和「怎麼搜」；AMH 解決「誰能寫」「能不能信」「怎麼審計」。你可以在 Mem0 上面加 AMH 治理層。

**Q: AMH 跟 MCP 的關係？**

MCP 定義 agent 怎麼呼叫工具。AMH 本身就是一個 MCP server，提供 10 個 MCP tools（write / read / tier-upgrade / transfer / forget / expire / audit / register_principal / authorize / status）。

**Q: 我只有一個 agent，需要 ACA 嗎？**

單一 agent 也能受益於 source_tier 和 content_hash dedup。但 ACA 的核心價值在多 agent 場景 — 當 agent 開始共享記憶時，沒有治理就是在等事故發生。

**Q: Anti-Ouroboros 會不會太嚴格？**

這是可配置的。`~/.amh/config.json` 中 `governance.anti_ouroboros` 可以關掉。但我們強烈建議保持開啟 — [13 篇獨立研究](docs/Anti_Ouroboros_Evidence.md)都指向同一個結論：沒有這條規則，知識品質會不可逆地退化。

---

## License

Apache 2.0
