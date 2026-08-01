# 2026-08-01 解除 tier 自動抬升 + 放寬 anti-Ouroboros

> 範圍：`packages/core` governance 層｜Risk：中（改寫入路徑）｜Outcome：PR #1 merged，111 test pass

## 觸發點

用 arXiv 2606.30306《Always-On Agents》survey 的六個治理軸
（authority / scope / mutability / provenance / recoverability / actionability）
對 AMH 做 read-only audit，發現本機 audit log 1,199 events（33 天）
**operation 100% 是 `write`** —— supersede / revoke / expire / tier_upgrade 各 0 筆。

抽樣 121 筆線上記錄：status 全 `active`，`valid_until` / `supersedes` /
`trust_proof` / `provenance_chain` 全部 0。其中 21 筆標 `human_confirmed`，
**無一有 `trust_proof`**。

## Root cause

`operations/knowledge.ts:50-52`：

```ts
const tier = input.source_tier ?? (supersedes ? "human_confirmed" : "llm_derived");
```

只要帶 `supersedes`，tier 就被設成 `human_confirmed`、source_type 設成 `human`
—— **不論執行者是 agent 還是人**。原始註解說這是為了讓 supersede 不被
anti-Ouroboros 擋下，代價是在沒有任何人看過的記錄上蓋「人類已確認」的章。

連帶效果：因為 tier 每次都被抬升，`governance/source-tier.ts:17` 的
anti-Ouroboros 檢查（要求 parent 與 child 皆為 `llm_derived` 才擋）
**33 天內從未觸發過**。

## 修法

**D1**：tier 一律預設 `llm_derived`，要 `human_confirmed` 必須顯式指定。
CLI 已有 `--tier`（`cli.ts:351`），不需新增入口。

**D2(b)**：`checkSourceTier` 從硬性 throw 改為回傳治理標記。
單獨做 D1 會讓 anti-Ouroboros 開始擋 agent 發起的 llm→llm supersede，
而抽樣 121 筆中 99 筆是 `llm_derived` —— agent 將幾乎無法自行 supersede。

放寬不等於移除，每次發生都會留痕：進 `governance_applied`
（`llm_to_llm_supersede`）並寫進 supersede audit event 的 `details`，事後可 grep。

> ⚠️ D2(b) 是**有期限的 observation-only 實驗**，2026-09-01 到期，
> **預設回退**（未經 ratify 續期即視同 revert 生效）。
> 完整實驗設計、觀測指標 M1-M4、回退觸發條件 R1-R5 見
> `~/Documents/agent-council/2026-08-01-amh-governance-gap/EXPERIMENT-D2.md`。

## 改動清單

- `packages/core/src/operations/knowledge.ts:50-52` — tier 不再從 supersedes 推斷
- `packages/core/src/governance/source-tier.ts` — checkSourceTier 回傳 marker；新增 `LLM_TO_LLM_SUPERSEDE`；`AntiOuroborosError` 保留匯出但不再拋出
- `packages/core/src/governance/write-gate.ts:123-129` — 收集 marker 進 governanceApplied
- `packages/core/src/operations/write.ts` — supersede audit details 帶 `governance:` marker
- `packages/core/src/operations/knowledge.test.ts` / `supersede.test.ts` — 新增 3 條、改寫 1 條

## Commits

| SHA | 改動 |
|---|---|
| `5782a47` | 放寬 anti-ouroboros 為標記加稽核（D2b） |
| `6fbafc9` | 解除 supersede 時的 tier 自動抬升（D1） |

PR #1，rebase merge（main 為線性歷史）。

## 驗證

`tsc --noEmit` 乾淨；`npm test` **111 pass / 0 fail**（commit 前、push 前、merge 後各跑一次）。
GitHub Actions `test` job pass（27s）。

新增 test：
- supersede 的放寬標記必須進 audit event
- `writeKnowledge` supersede 後 tier 維持 `llm_derived`、type 維持 `agent`
- 顯式 `human_confirmed` 仍可用且不帶放寬標記

## Open issues / Follow-up

1. **D5 `trust_proof` write-gate — defer**。真正的 blocker 是 D7 不是管線：
   `confirmed_by` 要能驗證需要 identity store，而 identity 與 authority 一樣是
   **sqlite-only、正式環境（memhall store）無 backend**。補了入口也只是可偽造的表單。
2. **D6 audit 耐久化 — 驗收條件已定，解法未選**。見
   `~/Documents/agent-council/2026-08-01-amh-governance-gap/D6-DURABILITY-CRITERIA.md`
   （AC1-AC7 + 6 個候選未評估，含「不做」為合法選項）。
   新發現：`~/.claude/evidence/vault.jsonl` 已有運行中的 hash chain 實作可參考（OL-013）。
3. **D7 authority 平面 — defer**。`checkAuthority()` 在整個 repo 只有定義與測試，
   write/revoke/expire 路徑零呼叫。接線前需先寫 memhall backend 的 authority store。
4. **一般化的 anti-pattern**：本次 bug 的本質是「為了讓操作通過檢查，
   而自動偽造該檢查所依據的欄位」。值得寫進 AMH 的 CLAUDE.md。

## 參考

- AMH entry: `01KYXTZJMN7EDKG5SKH4Y7FX9C`（namespace `project:mk-agentos`）
- Council: `~/Documents/agent-council/2026-08-01-amh-governance-gap/`（council-lite，三席盲審，Decision Ledger D1-D8）
- 交接包: `~/Documents/agent-council/2026-08-01-governance-marathon-handoff/`
- 論文: arXiv 2606.30306 *Always-On Agents: A Survey of Persistent Memory, State, and Governance in LLM Agents*
