# UMP / AMH / MemFS / AMP Benchmark 深度分析

> 面向 AMH v0.1 開發者的競品與標準研究報告

***

## 1. UMP (Universal Memory Protocol) 完整規格

### 1.1 定位與設計理念

UMP 版本 0.1 由 edihasaj (Edi Hasaj) 發布，定位為「第三個 interop 層」：MCP 管 tools、A2A 管協調、UMP 管 memory。核心主張是「What MCP did for tools, UMP does for memory」——跨 harness、store、vendor 的可攜帶記憶標準。[^1][^2]

五個設計約束（優先順序）：[^1]
1. **Minimal surface** — 6 個 operation、1 個 record type
2. **Ride existing rails** — 主 binding 是 MCP profile，不新增 transport
3. **Don't invent data model** — 復用 W3C PROV、W3C DID、PAM/MIF/LangMem 詞彙
4. **User-owned & portable** — operator 持有簽名 key，非 model vendor
5. **Safe by construction** — supersession 而非刪除；rehydration injection-resistant

### 1.2 Memory Record Schema 完整欄位

UMP record 是協議的原子單位，所有 operation 都在 produce 或 consume record。以下是從 spec 整理的欄位清單：[^1]

#### 核心識別欄位

| 欄位 | 類型 | 必填層級 | 說明 |
|------|------|----------|------|
| `id` | `urn:ump:<id>` | L1+ | L1 = 128-bit base32 隨機；L2+ = content hash (BLAKE3) |
| `kind` | enum | L1+ | `semantic / episodic / procedural / working / identity` |
| `body` | string (Markdown) | L1+ | 記憶內容本文，NEVER 直接 interpolate 進 system prompt |

#### Scope 欄位（組合結構）

| 欄位 | 類型 | 說明 |
|------|------|------|
| `scope.owner` | DID (did:key or opaque) | 記憶擁有者，L0/L1 可用 opaque string |
| `scope.namespace` | string | 如 `project:X`、`agent:Y` |
| `scope.visibility` | `private / shared / public` | 存取控制層級 |

#### 時間欄位（bi-temporal）

| 欄位 | 說明 |
|------|------|
| `valid_from` | 事實在世界上開始為真的時間 |
| `valid_to` | 事實失效時間（supersession 時設定，非刪除） |
| `created` | 系統寫入時間（transaction time） |
| `observed` | 系統觀察到事實的時間 |
| `supersedes` | 指向被本 record 取代的舊 record URN |
| `superseded_by` | 指向取代本 record 的新 record URN |

#### Lifecycle Hints（engine-facing，非 normative）

| 欄位 | 說明 |
|------|------|
| `status` | `active / tombstoned / candidate / draft` |
| `confidence` | 0-1 浮點，producer 應設定，consumer MAY 用於 ranking |
| `salience` | 0-1 浮點，相關性提示 |
| `decay` | 衰減提示（具體曲線由引擎決定，spec 不規範） |

#### Relations（開放詞彙）

| 關係類型 | 說明 |
|----------|------|
| `about` | subject/entity 關聯（entity: 節點） |
| `contradicts` | 矛盾關係 |
| `depends_on` | 依賴關係 |
| `derived_from` | 推導來源 |
| `duplicate_of` | 重複記錄指標 |

#### Provenance（W3C PROV 對齊，L2+ 必填）

| 欄位 | W3C PROV 對應 | 說明 |
|------|----------------|------|
| `provenance.actor` | Agent | 寫入的 agent DID |
| `provenance.actor_kind` | — | `human / agent / import` |
| `provenance.method` | Activity | 記憶的產生方式 |
| `provenance.source` | Activity | 來源資訊 |
| `provenance.source.provider` | — | cross-vendor import 的來源 provider |
| `provenance.evidence` | Derivation | 推導依據 |

#### Consent（L0+ 必填執行）

| 欄位 | 說明 |
|------|------|
| `consent.retention` | 最大保留時長；到期後 tombstone |
| `consent.exportable` | boolean，是否可跨 boundary 匯出 |
| `consent.redact` | JSON-path 陣列，匯出/分享時自動遮蔽 |

#### Integrity（L3 必填，L2 可選）

| 欄位 | 說明 |
|------|------|
| `integrity.hash` | BLAKE3 of JCS canonical JSON（不含 integrity 物件本身） |
| `integrity.signature` | operator DID key 的簽名 |
| `integrity.key_id` | 簽名用的 DID key reference |

### 1.3 Operations 完整定義

UMP 定義 **6 個核心 operation**，分 L1/L2/L3 層級：[^3][^1]

| Operation | 層級 | 語意 |
|-----------|------|------|
| `capabilities` | L1 | 協商 handshake，無 memory side effects；MUST 在呼叫任何 optional feature 前執行 |
| `recall` | L1 | 搜尋 memory；query + scope → ranked records；engine-agnostic（vector/BM25/graph 均合規）；支援 `valid_at` point-in-time 查詢 |
| `remember` | L1 | 寫入 memory；server MAY 做 dedup merge；MUST 明確回報是否 merged |
| `get` | L1 | 以 ID 直接取得單筆 record |
| `revise` | L2 | 非破壞性更新；建立 successor 並 `supersedes` 舊 record；舊 record 可用 `valid_at` 過去時間查詢 |
| `forget` | L2 | Tombstone（status → `tombstoned`）；預設保留供 audit；`hard:true`（owner-only）才真正刪除 |
| `feedback` *(optional)* | L3 | 回報 injected memory 的結果（`followed / overridden / ignored / contradicted`），供 engine 學習 |
| `subscribe` *(optional)* | L3 | 長連線 stream，監聽 scope 內的 record 變更（MCP notifications / SSE） |

> 注意：spec 正文沒有 `exchange` 這個 operation 名稱，對應功能是 `share + visibility: shared` + capability token，以及 file export binding（`*.ump.json`）。

### 1.4 MCP 整合方式

UMP 的主要 binding 就是 MCP profile——這是設計的核心，而非附加功能：[^1]

- 每個 operation 對應一個 **MCP tool**，保留命名：`ump.capabilities`、`ump.recall`、`ump.remember`、`ump.get`、`ump.revise`、`ump.forget`、`ump.feedback`[^3]
- Memories 也可以作為 **MCP Resources** 在 `ump://` URI scheme 下暴露（`ump://{project}/{id}`），供 read-only 瀏覽
- Claude Code、Codex、Cursor 等任何 MCP host 可以**今天**就採用，零 spec 改動[^3]
- HTTP binding 供非 MCP 消費者使用（Python FastAPI、Go、Swift 等），Bearer token 認證
- File binding (`*.ump.json` / `*.ump.md`) 作為 L0 靜態匯出格式，`/.well-known/ump.json` 做 discovery

### 1.5 Reference Implementation

官方 reference implementation 是 `@universalmemoryprotocol/core`（TypeScript/Node.js NPM 套件），包含：[^3]
- UMP record format 完整實作
- MCP / HTTP / file 三種 binding
- Conformance runner（測試向量）
- 多種 Store adapter：`JsonFileStore`（預設）、`InMemoryStore`、`MarkdownDirectoryStore`、`PostgresStore`、`SqliteStore`、`RedisStore`、`VectorStore`、`QdrantStore`、`PineconeStore`、`WeaviateStore`、`RecallStore`

安裝方式：
```bash
# MCP host 一行接入（Claude Code / Cursor / Codex）
npx -y @universalmemoryprotocol/core ump-memory

# CLI
npx -y @universalmemoryprotocol/core ump mmand>
```

記憶預設持久化到 `~/.ump/memory.ump.json`。[^3]

### 1.6 Conformance Levels

| Level | 必須支援 |
|-------|----------|
| **L0** Portable Record | Parse/emit `*.ump.json` / `*.ump.md`；honor `consent.redact` |
| **L1** Core | L0 + `capabilities`, `recall`, `remember`, `get`；5 種 kinds；1 種 binding |
| **L2** Standard | L1 + `revise`, `forget`；bi-temporal `valid_at`；provenance；scope + consent enforcement |
| **L3** Full | L2 + `feedback`, `subscribe`；integrity verify/sign；capability tokens；injection-resistant rehydration |

***

## 2. UMP vs AMH v0.1 Schema 逐欄比較

### 2.1 核心欄位對照表

| AMH 欄位 | AMH 語意 | UMP 對應欄位 | 差異說明 |
|----------|----------|--------------|----------|
| `memory_id` | 唯一記憶識別符 | `id` (`urn:ump:<id>`) | UMP 加了 URN namespace；L2+ 為 content-addressed hash |
| `amh_version` | AMH schema 版本 | *無直接對應* | UMP 版本在協議層（"UMP 0.1 / L2"），不在 record 內 |
| `version` | 記憶版本號 | `supersedes` / `superseded_by` | AMH 用版本號；UMP 用 bi-temporal supersession chain（更強的歷史追蹤） |
| `status` | `draft/active/deprecated/archived` | `status` | 高度重疊；UMP 加了 `tombstoned` 狀態，語意上更嚴格（tombstone ≠ delete） |
| `agent_id` | 建立者/擁有者 agent | `scope.owner` (DID) + `provenance.actor` | AMH 是 string；UMP 是 W3C DID（可驗證、可攜帶） |
| `namespace` | 記憶命名空間 | `scope.namespace` | 直接對應，AMH 概念與 UMP 一致 |
| `memory_type` | `decision/fact/preference/constraint/lesson/risk` | `kind` | **最大差異之一**，詳見 §2.2 |
| `content.format` | `markdown/json/text` | *隱含於 `body` 的 Markdown 格式* | UMP `body` 固定為 Markdown；AMH 更彈性 |
| `content.value` | 記憶內容字串/物件 | `body` | 功能相同；UMP 強制 Markdown |
| `source.type` | 來源類型 | `provenance.actor_kind` / `provenance.method` | AMH 單一欄位；UMP 拆分為 W3C PROV 三元組（actor/method/evidence） |
| `source.ref` | 來源引用 | `provenance.source` / `provenance.evidence` | AMH 單一 ref；UMP 更細緻 |
| `created_at` | 建立時間戳 | `created` + `valid_from` | AMH 單一時間；UMP bi-temporal（2 個時間軸），更能處理 "知道的時間" vs "事實成立的時間" |
| `created_by` | 建立者識別 | `provenance.actor` | AMH 是 string；UMP 是 DID |

### 2.2 Memory Type vs Kind 的根本差異

這是 AMH 與 UMP 最重要的架構差異：

**AMH `memory_type`** 是以**認知功能**分類（決策 / 事實 / 偏好 / 約束 / 教訓 / 風險）：

| AMH memory_type | 對應業務語意 |
|-----------------|-------------|
| `decision` | 已做出的決定與理由 |
| `fact` | 中立事實陳述 |
| `preference` | 偏好設定 |
| `constraint` | 約束條件 |
| `lesson` | 從錯誤/經驗中學到的教訓 |
| `risk` | 風險識別 |

**UMP `kind`** 是以**認知架構**分類（來自 LangMem/MemoryOS 研究）：

| UMP kind | 認知模型對應 |
|----------|-------------|
| `semantic` | 語意記憶（通用事實/偏好） |
| `episodic` | 情節記憶（特定時間/地點的事件） |
| `procedural` | 程序記憶（行為規則/how-to） |
| `working` | 工作記憶（短期任務狀態） |
| `identity` | 身份記憶（user/agent 特質） |

**對 AMH 的啟示**：AMH 的分類更貼近業務語義（product manager / enterprise 用語），而 UMP 的分類更貼近認知科學。可考慮在 AMH 的 `memory_type` 之外，增加一個 `cognitive_kind` 欄位做跨標準對齊。

### 2.3 UMP 有但 AMH 沒有的欄位

| UMP 欄位 | 功能 | 對 AMH 的建議 |
|----------|------|---------------|
| `valid_from` / `valid_to` | Bi-temporal 時間（事實在世界上的有效期） | AMH 只有 `created_at`，強烈建議加入 `valid_until` |
| `supersedes` / `superseded_by` | 版本鏈結（非破壞性更新） | AMH `version` 欄位沒有雙向鏈結 |
| `consent` (retention/exportable/redact) | 資料主權/隱私 | AMH 完全缺失，企業場景關鍵 |
| `integrity` (hash/signature) | 防竄改 + 可驗證所有權 | AMH 無加密完整性 |
| `relations` | 記憶間的語意關係圖 | AMH 無，對 knowledge graph 場景有缺口 |
| `scope.visibility` | `private/shared/public` multi-agent 存取控制 | AMH 無明確的 visibility 控制 |
| `salience` / `decay` | Engine-facing ranking hints | AMH 無優先級/衰減提示 |

### 2.4 AMH 有但 UMP 沒有的欄位

| AMH 欄位 | 功能 | 備註 |
|----------|------|------|
| `amh_version` | Schema 版本宣告 | UMP 在協議層宣告，不放進 record |
| 細分業務型別（`decision`, `constraint`, `lesson`, `risk`） | 業務語意分類 | UMP `kind` 無法直接表達 `risk` 或 `lesson` |
| `content.format` 多格式 | 支援 markdown/json/text | UMP `body` 固定 Markdown |

***

## 3. Letta MemFS YAML Frontmatter 格式

### 3.1 Memory File 結構

Letta MemFS 是 Letta Code 的 git-backed memory system，每個 memory file 都是帶 YAML frontmatter 的 Markdown 檔案。根據官方文件，frontmatter 欄位如下：[^4]

```yaml
---
description: "此檔案包含的內容的簡短描述（永遠對 agent 可見，即使 file 沒被載入）"
limit: 5000  # 可選，舊版 legacy character cap
---

# 記憶內容（Markdown 本文）

...
```

**關鍵規則**：
- `description` 是**必填**欄位，agent 在 file 未被 load 時仍看得到（用於 progressive disclosure）[^4]
- `limit` 是可選的 legacy 欄位（字元上限），新版不建議依賴
- 尚無公開的官方 JSON Schema 定義文件（截至 2026-06）

### 3.2 目錄結構 Convention

```
~/.letta/agents/<agent-id>/memory/       # (Letta API 模式)
~/.letta/lc-local-backend/memfs/<agent-id>/memory/  # (Local 模式)
├── system/                    # ← 永遠全文載入 system prompt
│   ├── persona.md             # agent 人格
│   ├── working_style.md       # 使用者工作習慣
│   └── project_facts.md       # 核心專案事實
├── episodic/                  # 情境記憶（通常不在 system/）
│   └── 2026-06-01-deploy-issue.md
├── knowledge/                 # 知識記憶
│   └── architecture-decisions.md
└── skills/                    # Agent-scoped skills
    └── my-skill/
        └── SKILL.md           # Anthropic SKILL.md 格式
```

**重要 Convention**：[^5][^4]
- `system/` 目錄內的檔案「全文、每 turn 強制載入」；外部的只顯示 filetree + frontmatter description
- agent 自主管理層級：可以把 file 移進/移出 `system/` 來控制哪些東西永遠在 context
- 每次記憶修改必須 `git commit`（commit message 即記憶學習的 changelog）
- Memory subagent 用 **git worktree** 做平行寫入，避免 main agent 阻塞[^5]
- `/.init` 指令啟動記憶初始化（並行 subagents 掃描 Claude Code/Codex 歷史）

### 3.3 MemFS 無公開 Schema 文件的說明

MemFS 的 frontmatter 刻意保持極簡（只有 `description` + optional `limit`），因為 Letta 的設計哲學是讓 **agent 自主管理記憶結構**，而非強制 schema。這與 UMP 和 AMH 的 explicit schema approach 形成鮮明對比：[^5]

| 面向 | Letta MemFS | UMP | AMH |
|------|-------------|-----|-----|
| Schema 複雜度 | 極簡（2 個 frontmatter 欄位） | 中等（~20 個欄位） | 中等（~12 個欄位） |
| 結構決定者 | Agent 自主 | Spec 規定 | 開發者定義 |
| 版本控制 | Git-native | supersedes 鏈 | version 欄位 |
| 人類可讀 | ✅ | ✅（*.ump.md） | ✅ |
| 機器可驗證 | ❌ | ✅（signature/hash） | ❌ |

***

## 4. AMP LoCoMo Benchmark 分析：81.6% 的可信度

### 4.1 LoCoMo 是什麼？

LoCoMo（Long Conversational Memory）是 Snap Research 在 ACL 2024 論文「Evaluating Very Long-Term Conversational Memory of LLM Agents」中發布的 benchmark，目前是 agent memory 領域的主流評測標準之一。[^6][^7]

**Dataset 特性**：[^8][^9]
- 10 組（部分文獻說 50 組）人工驗證的長期對話，每組 ~300 turns、~9K tokens
- 對話跨越最多 35 個 sessions，模擬 weeks-to-months 的長期記憶
- 測試 4 種推理類型：**single-hop**、**multi-hop**、**temporal**、**open-domain**（adversarial 為第 5 類）
- 使用 **LLM-as-a-Judge** 評分（通常是 GPT-4o-mini 作為 judge，比較 answer vs ground truth）

**評分方式**：[^10]
- Judge 模型比較 memory system 的答案與 ground truth，給出 pass (1) 或 fail (0)
- 最終分數 = pass rate across all questions（即 LLM Judge Score = `llm_score`）

### 4.2 AMP 的 81.6% 是否可信？

**可信度評估：低至中等**，理由如下：

**問題一：Mem0 的 21.7% 基準嚴重失真**

AMP 對比的 Mem0 分數（21.7%）來自 AMP 作者自己跑的評測，而非 Mem0 官方數字。Mem0 官方 2026 年 5 月公布的新演算法分數是 **92.5% on LoCoMo**。即便是 2025 年的舊演算法，多個獨立評測也顯示 Mem0 在 62-68% 範圍。Zep 的獨立分析也曾指出，Mem0 的競品比較存在「incorrect implementation」問題。[^11][^12][^13][^14]

**問題二：AMP benchmark 無透明方法論**

GitHub repo（28 stars，3 forks）雖然有 `benchmarks/` 目錄（May 2026 新增），但公開的 README 對評測細節（使用哪個 judge model、prompt 如何設計、使用哪個 LoCoMo subset、哪個 LLM 做 ingestion/retrieval）均未說明。[^15]

**問題三：LoCoMo 本身的評測侷限**

LoCoMo 原始對話長度 16K-26K tokens，對現代 LLM 的長 context window 而言已不夠具挑戰性（直接 full-context 可達 73-88%）。Letta 的評測顯示：一個「minimal agent + filesystem」就能以 **74.0%** 打過 Mem0 自報的 68.5%。[^16][^14]

**問題四：評分方法影響結果幅度極大**

Judge prompt 的設計、使用的評分 model 微小差異就可以讓分數擺盪雙位數。Hindsight/Vectorize 的 AMB 框架明確指出這個問題並要求完全公開 judge prompt。[^17]

**目前 LoCoMo 可信分數對照**（截至 2026-06）：

| System | LoCoMo 分數 | 評測方 | 可信度 |
|--------|-------------|--------|--------|
| Mem0（新演算法） | 92.5% | Mem0 自測 + 開源 | 中（自測） |
| MemoryLake | 94.03% | MemoryLake 自測 | 中（自測） |
| Hindsight | 92.0% | Vectorize AMB（第三方框架） | 高 |
| Memori | 81.95% | Memori 自測 | 中 |
| AMP | 81.6% | AMP 作者自測 | **低**（無公開方法論） |
| Zep | ~80% | Zep 自測（修正後） | 中 |
| Letta agent | 74.0% | Letta 自測 | 中 |

### 4.3 AMH 應採用的 Evaluation Framework

基於以上分析，建議 AMH benchmark 採用以下策略：

#### 首選框架：Hindsight Agent Memory Benchmark (AMB)

**理由**：[^17]
- 完全開源（`github.com/vectorize-io/agent-memory-benchmark`）
- 公開 judge prompt、ingestion 方法、scoring LLM——可 reproduce
- 支援 **single-query** 和 **agentic** 兩種評測模式
- 包含 LoCoMo + LongMemEval + LifeBench + PersonaMem + MemBench + MemSim 六個 dataset
- 有公開 leaderboard（agentmemorybenchmark.ai）

#### 推薦評測 Dataset 組合

| Dataset | 測試什麼 | AMH 相關性 |
|---------|----------|------------|
| **LoCoMo** | 跨 session 的 factual recall、temporal、multi-hop | 基礎線，必跑（但單獨用不夠） |
| **LongMemEval** | knowledge update、belief revision（事實變更） | AMH `version` / `status` 機制的強測試 |
| **LongMemEval** | multi-session 跨 agent 的記憶一致性 | AMH `namespace` + `agent_id` 場景 |
| **PersonaMem** | preference 追蹤 | AMH `memory_type: preference` |
| **MemSim** | conditional/comparative 問題，需 synthesize 多條記憶 | AMH `lesson` / `decision` 型別 |

#### AMH 特有的評測維度（現有 benchmark 沒覆蓋）

AMH 有幾個獨特欄位，需要客製化測試：

1. **`memory_type` 分類精準度**：評測 agent 是否能正確把記憶分類為 decision/fact/lesson/risk（可用 LLM-judge 評估 type consistency）
2. **Version + status 生命週期**：測試 `deprecated` / `archived` 記憶是否正確地不被 recall（LoCoMo 有 temporal 題型部分覆蓋）
3. **Constraint 遵守率**：記憶了 `constraint` 類型的記憶後，agent 的行為是否真的改變（需要 agentic evaluation mode）
4. **Cross-namespace isolation**：不同 `namespace` 的記憶是否正確隔離（現有 benchmark 沒有）

#### 建議 Baseline 設定

```python
# AMH benchmark 最小可比較設定
evaluation_config = {
    "judge_model": "gpt-4o-mini",          # 與 Mem0/MemMachine 一致
    "ingestion_model": "gpt-4o-mini",       # 明確宣告
    "dataset": "locomo",                    # 使用 snap-research/locomo 原始集
    "eval_mode": "single-query",            # 先跑 single-query 建立 baseline
    "score_threshold": "pass/fail",         # LLM Judge binary score
    "publish_judge_prompt": True,           # 必須公開才有公信力
    "report_tokens_per_query": True,        # 成本效率是關鍵指標
}
```

***

## 5. 總結：對 AMH v0.1 的設計啟示

### 快速行動項目

1. **加入 `valid_until` 欄位**（對應 UMP `valid_to`）——AMH 的 `version` + `status: deprecated` 無法表達「這個事實在 2026-12 前有效」的 bi-temporal 語意
2. **加入 `consent` 子物件**（`retention` + `exportable`）——企業場景的合規要求，UMP 已規範，AMH 完全空白
3. **加入 `supersedes` 欄位**——讓記憶更新有歷史鏈結，而非 `version: 2` 這種不可追蹤的方式
4. **考慮 `scope.visibility`**（`private/shared/public`）——multi-agent 協作場景的必要控制
5. **Benchmark 採用 Hindsight AMB 框架**，在 LoCoMo + LongMemEval 上建立可公開比較的 baseline，並公開 judge prompt

### Schema 相容性路徑

AMH → UMP 的 mapping 是可行的（`memory_id` → `id`、`agent_id` → `scope.owner`、`namespace` → `scope.namespace`），但需要注意：
- UMP 無法直接表達 AMH 的業務語意類型（`risk`、`lesson`、`constraint`）
- 建議 AMH 加一個 `ump_kind` 欄位作為橋接層，允許 AMH record 匯出為合規 UMP record

---

## References

1. [Specification | Universal Memory Protocol](https://universalmemoryprotocol.io/specification/) - This document specifies UMP: a portable record format and a set of negotiated operations for reading...

2. [Universal Memory Protocol](https://universalmemoryprotocol.io) - A transport-neutral memory protocol for AI agents. What MCP did for tools, UMP does for memory - neg...

3. [Quickstart - Universal Memory Protocol](https://universalmemoryprotocol.io/quickstart/) - The reference implementation ( @universalmemoryprotocol/core ) ships the UMP record format, server o...

4. [MemFS | Letta Docs](https://docs.letta.com/letta-code/memfs/) - MemFS (memory filesystem) is Letta Code's git-backed memory system. Your agent's memory is stored as...

5. [Introducing Context Repositories: Git-based Memory for Coding ...](https://www.letta.com/blog/context-repositories/) - We're introducing Context Repositories, a rebuild of how memory works in Letta Code based on program...

6. [Evaluating Very Long-Term Conversational Memory of LLM Agents](https://arxiv.org/abs/2402.17753) - Based on LoCoMo, we present a comprehensive evaluation benchmark to measure long-term memory in mode...

7. [State of AI Agent Memory 2026: Benchmarks, Architectures ... - Mem0](https://mem0.ai/blog/state-of-ai-agent-memory-2026) - LoCoMo, LongMemEval, and BEAM benchmarks are now the standard for comparing memory architectures. 92...

8. [Evaluating Very Long-Term Conversational Memory of LLM Agents](https://snap-research.github.io/locomo/) - Based on LOCOMO, we present a comprehensive evaluation benchmark to measure long-term memory in mode...

9. [LoCoMo benchmark using MemoryLake - GitHub](https://github.com/memorylake-ai/memorylake-locomo-benchmark) - LoCoMo (Long-term Conversational Memory) is a rigorous benchmark created by SNAP Research to evaluat...

10. [MemMachine Reaches New Heights on LoCoMo](https://memmachine.ai/blog/2025/09/memmachine-reaches-new-heights-on-locomo/) - LoCoMo provides a new standard for evaluating the true long-term conversational memory of AI agents....

11. [Benchmarked 4 AI Memory Systems on 600-Turn Conversations](https://www.reddit.com/r/LocalLLaMA/comments/1rckcww/benchmarked_4_ai_memory_systems_on_600turn/) - Key findings: · What stands out: Mem0 achieved 14 percentage points higher accuracy than OpenAI Memo...

12. [LoCoMo Benchmark Results - Memori](https://memorilabs.ai/docs/memori-cloud/benchmark/results/) - Our evaluation on the LoCoMo benchmark demonstrates the effectiveness of this approach: High-Quality...

13. [Mem0 Research Paper: Token-Efficient Memory Algorithm](https://mem0.ai/research) - Mem0's new token-efficient memory algorithm hits 92.5 on LoCoMo, 94.4 on LongMemEval, and 64.1/48.6 ...

14. [Is Mem0 Really SOTA in Agent Memory? - Zep](https://blog.getzep.com/lies-damn-lies-statistics-is-mem0-really-sota-in-agent-memory/) - Closer examination of Mem0's results reveal significant issues with the chosen benchmark, the experi...

15. [akshayaggarwal99/amp - The Agent Memory Protocol - GitHub](https://github.com/akshayaggarwal99/amp) - I benchmarked AMP against the leading competitor (Mem0) on the complex LoCoMo dataset. The results w...

16. [Benchmarking AI Agent Memory: Is a Filesystem All You Need? - Letta](https://www.letta.com/blog/benchmarking-ai-agent-memory/) - Letta Memory Benchmark for evaluating model capabilities for agentic memory; Code for running the Lo...

17. [Agent Memory Benchmark: A Manifesto | Hindsight - Vectorize](https://hindsight.vectorize.io/blog/2026/03/23/agent-memory-benchmark) - The exact methodology — how ingestion works, how recall is scored, how the LLM judge is prompted. Th...

