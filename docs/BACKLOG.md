# Backlog

Repo 本地的技術債清單。跨專案、有被遺忘風險的「進行中計畫」放
`~/GitHub/mk-agentos/docs/OPEN-LOOPS.yaml`；這裡只放跟著本 repo 程式碼走的小型契約瑕疵。

完結的項目搬到底部 Closed 區並附日期，不刪除。

---

## BL-001 — `--next` / `--blocker` 未配 `--kind state` 時被靜默忽略

- **狀態**：open
- **開立**：2026-08-10（Codex review v1.5.0，第二輪；非阻擋項）
- **現象**：`amh write --next "…"` 若沒有同時傳 `--kind state`，該值不會出現在
  任何輸出，也不會有任何提示。呼叫端會以為寫進去了。
- **影響**：不是注入風險，純 UX。但 agent 端不易察覺自己漏傳 `--kind state`。
- **建議修法**：在 `cmdWrite` 偵測到 `--next` / `--blocker` 但 `kind !== "state"`
  時報錯或印警告。傾向報錯，與 `requireSingleLine` 的 fail-loud 立場一致。
- **相關**：`packages/core/src/cli.ts` `cmdWrite`、`packages/core/src/write-format.ts`

---

## BL-002 — `artifact` 路徑契約在 formatter 與 boot 之間不一致

- **狀態**：open
- **開立**：2026-08-10（Codex review v1.5.0，第一輪標為「既有相鄰缺陷、非該 patch 回歸」）
- **現象**：
  - CLI help 寫 `--artifact <path>` 是 absolute path，但 formatter 不驗證，
    相對路徑照收。`boot` 的路徑 regex 只認 `/…`、`~/…`、`X:\…`，
    所以 `docs/README.md` 寫得進去、`boot` 完全撈不到。
  - 含空白的路徑會被截斷：`/tmp/my docs/README.md` 只解析成 `/tmp/my`。
- **影響**：交接包 pointer 可能寫進去卻永遠不被 `boot` 顯示，且不會報錯。
- **建議修法**（Codex 建議一併定義，不要只補其中一半）：
  1. 相對路徑政策：寫入時拒絕，或明確定義解析基準
  2. 含空白路徑語法：支援引用格式，或明確拒絕
  3. 對應的解析測試，涵蓋 formatter 與 `boot` 兩端
- **相關**：`packages/core/src/write-format.ts`、
  `packages/core/src/operations/boot.ts`（artifact regex）

---

## BL-003 — `latest` / `boot` 的 20 筆視窗可能誤判 greenfield

- **狀態**：open
- **開立**：2026-08-10（Codex review v1.5.1，標為非阻擋）
- **現象**：`latestMemories` 向 store 要 `max(limit, 20)` 筆後，於**記憶體內**套
  `applyLifecycleFilter`。若視窗內多數為 `superseded` / `revoked` / 已過期，
  回傳筆數不保證補滿 `limit`；極端情況（最近 20 筆皆 inactive、第 21 筆才是 active
  state）會回傳空陣列，使 `boot` 輸出「No prior state」而實際上仍有可接班的狀態。
- **影響**：接班視窗誤判為 greenfield。發生條件嚴苛，但一旦發生會靜默丟失脈絡。
- **不要這樣修**：把 20 換成另一個更大的常數 —— 那只是延後問題（Codex 明確反對）。
- **建議修法**：使用 memory-hall 已提供的 `next_cursor` 分頁，持續取到
  (a) 有足夠 active 候選、(b) server 已耗盡、或 (c) 到達明確的 scan cap 為止。
  另一個選項是 server 端 lifecycle filter，但那會把 AMH 的治理語義耦合進
  memory-hall，且現行文件明示 `amh_status` 過濾留在 AMH read layer。
- **現況已由測試固定**：`latest.test.ts` 的
  `"20-record window limitation (BL-003, known)"` 斷言目前回傳空陣列。
  該測試是記錄現況，不是主張它正確；修好後應一併更新。
- **相關**：`packages/core/src/operations/latest.ts`、`packages/core/src/store/memhall.ts`
  （`listLatest` / `next_cursor`）

---

## BL-004 — 記憶投毒防禦：已有 provenance，缺 belief drift detection

- **狀態**：open；2026-08-10 登記。**前置是先讀原文**（見下方「證據品質」）。
- **背景**：2026 竄起一類針對 agent 長期記憶的攻擊（memory poisoning / context
  poisoning）。與 prompt injection 不同的是**時間解耦**——今天植入的內容，
  數週後才被語意觸發。攻擊目標是 agent 的「信念」而非單次輸出。
  既有防禦（工具契約、斷路器、I/O 審核）偵測的是惡意**動作**，不是被污染的**信念**。
- **AMH 現況對照**（依該領域提出的三項所需原語）：

  | 所需原語 | AMH 現況 |
  |---|---|
  | context provenance tracking | ✅ `provenance_chain` + supersede 鏈 + `audit --verify-chain` |
  | memory contracts（agent 可以相信什麼） | ✅ `tier`（raw_source / llm_derived / human_confirmed）+ `antiOuroboros` |
  | **belief drift detection** | ❌ **無** |

- **既有的真實破口**：2026-08-10 體檢發現 Grok 寫入的 39 筆中有 **20 筆自行標記
  `human_confirmed`**（Grok 的 wrap-up skill 當時缺少禁令，已補）。在治理視角這是
  不一致；**在記憶投毒視角，這是 memory contract 被 agent 自行提升信任層**——
  正是該機制要擋的東西。那 20 筆**尚未處理**，待 Maki 裁決。
- **可能的方向**（未評估，勿直接實作）：
  - 寫入時偵測與同 namespace 既有 active 記憶的語意衝突，標記而非拒絕
  - `tier` 提升需留 audit（`tier-upgrade` 已有，但沒有「異常提升」的偵測）
  - 定期以 `audit --verify-chain` 之外的方式檢查信念漂移
- **⚠️ 證據品質（重要）**：本條目**全部來自網路搜尋摘要，未讀任何原文**。
  部分來源是 Medium 個人文章而非同行評審。實作前必須先讀：
  - `arXiv:2606.04329` From Untrusted Input to Trusted Memory（系統性研究）
  - `arXiv:2605.23723` MemAudit（事後稽核、因果歸因）
  - `arXiv:2606.30566` Forensic Trajectory Signatures
  - `arXiv:2605.28201` Plant, Persist, Trigger（sleeper attack）
- **不要做的事**：在讀完原文前不要因為「聽起來很嚴重」就加防禦機制。
  AMH 現有的 tier / provenance / anti-Ouroboros 可能已覆蓋多數情境，
  盲目加東西會增加複雜度而未必增加安全性。
- **相關**：ICLR 2026 MemAgents workshop；`Awesome-Memory-for-Agents`（清華 C3I）

---

## Closed

（暫無）
