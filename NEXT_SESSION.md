# Next Session — Agent Memory Hall + ACA Ecosystem

> Last updated: 2026-06-16 (市場驗證完成 + Reddit 首發)

## Done (this session)

### ACA 市場驗證 + Launch
- 全員出動：Scout-1 (Perplexity 14 題) + Scout-2 (SuperGrok 16 題) + Codex adversarial (3/10→修正) + Gemini matrix (15 競品) + GPT-5.4 review (7 修正)
- 四份 launch post v2 draft 通過三重審查 + 內容審查
- Reddit r/AI_Agents 首帖已發：https://www.reddit.com/r/AI_Agents/comments/1u72i3l/
- 3 則技術回覆已回應（botpipe 互推 + contradiction handling + expiry/drift）
- HN Show HN 帳號太新被擋，待養號

### 關鍵市場發現
- Anti-Ouroboros + Conformance suite = 15 家競品全無（Gemini matrix 確認）
- MS Agent Governance Toolkit (2026-05) = 最大威脅
- 定位確認：ACA = MCP/A2A 的 governance companion（不是「nobody is solving governance」）
- arXiv 2605.16746 "memory laundering" = 學術互補（偵測 vs governance）

## Next Session

| 優先級 | 行動 |
|---|---|
| 🔴 | **關注 Reddit 帖回覆**，收集反饋調整後續帖 |
| 🔴 | **6/20 發 LinkedIn 中英版 + X thread**（draft 已備好） |
| 🟡 | DM arXiv 2605.16746 作者 |
| 🟡 | HN 養號（在 agent governance 帖留言累積 karma） |
| 🟡 | OWASP ASI coverage matrix blog（6 月底） |
| 🟡 | LangChain governance middleware PR（6 月底） |
| 🟡 | @anilsprasad DM |
| 🟡 | 找朋友試用 ACA adapter |
| 🟢 | npm scope 遷移評估（@chibakuma → @aca-protocol） |
| 🟢 | ICLR "Agents in the Wild" workshop（確認 deadline） |

## 三本柱 ACA 覆蓋狀態

| 柱 | Package | Version | ACA 覆蓋 | Tests |
|---|---|---|---|---|
| **1. Agent Memory Hall** | `@chibakuma/agent-memory-hall` | 1.0.1 | L1+L2+L3+L4+L5+GP（全棧） | 92 |
| **2. aca-govern** | `@chibakuma/aca-govern` | 0.1.2 | L1 audit（MCP governance proxy） | 4 |
| **3. mk-council-public** | — (Python, GitHub only) | — | L5 Decision endpoints | 107 |

## 其他 npm Packages

| Package | Version |
|---|---|
| @chibakuma/aca-types | 0.1.1 |
| @chibakuma/aca-conformance | 0.1.0 |

## Key Documents

- ~/Documents/ACA-Protocol-Overview.md (v5)
- ~/Documents/ACA-Ecosystem-Launch-Plan.md (v4)
- ~/Documents/ACA-Launch-Drafts.md
- ~/Documents/ACA-LinkedIn-Post.md (中英雙版)
- ~/Documents/ACA-Friend-Onboarding.md
