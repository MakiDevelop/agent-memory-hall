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

## Closed

（暫無）
