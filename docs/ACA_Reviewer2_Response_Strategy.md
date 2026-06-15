# ACA Reviewer #2 — 應對策略

> 本文件為內部策略文件，不對外發布。
> 基於 Scout-1（Perplexity Max）+ Scout-2（SuperGrok）2026-06-15 偵察結果。

---

## 毒點 #1：沒證明市場需要 ACA

### 核心質疑
只證明別人缺什麼，沒證明開發者因此受苦。

### 手上的彈藥

**產業事故（4 件重大、有 URL）**
- PocketOS/Cursor：9 秒刪 production DB，unscoped token（2026-04）
- Replit：刪 DB + 偽造 4,000 筆假資料 + 說謊（2025-07）
- Amazon Q：stale wiki 導致零售 outage（2026-03）
- Amazon Retail：6.3M 訂單遺失，單人無 guardrails 部署（2026-03）

**調查統計（3 組獨立來源交叉驗證）**
- CSA/Zenity：53% 組織 agent 曾越權（2026-04）
- Gravitee：88% 組織已有 agent 安全事故（2026-06）
- Gartner：預測 2027 年 40% 企業將因治理缺口下架 agent

**開發者真實痛（Reddit + X，非理論）**
- Reddit r/AI_Agents 多人棄 LangChain/CrewAI：「debugging nightmare at scale… no shared operational record」
- Robert Youssef（380+ likes）：「AI agents can't share memory without corrupting it… built entire frameworks without a single consistency model」
- kvro（180+ likes）：frameworks 要嘛毒化未來 run，要嘛每次歸零

**框架方自己承認（最有說服力）**
- Microsoft Agent Governance Toolkit 官方 blog（2026-04）：明確指出 LangChain/AutoGen/CrewAI 提供 zero runtime governance

### 應對策略
- 建立 `docs/Evidence_Catalog.md`，按 ACA Layer 分類，每條附 URL + 日期 + 一句話摘要
- 目標 30+ 條（目前已有 22 個事故 + 10+ 開發者證詞 = 充足）
- 在 ACA spec §1 加一段「Evidence Base」引用 top 5 最具代表性的案例
- 不需要 50 條才動——20 條有 URL 的真實事故已經足夠回應「誰痛到願意導入」

---

## 毒點 #2：L4 Authority 最脆弱

### 核心質疑
治理模式因組織而異，容易被質疑是 Maki 個人偏好而非通用規則。

### 手上的彈藥

**證明 Authority 是工程問題不是偏好問題**
- PocketOS：unscoped token = 沒有 Authority 邊界的直接後果
- Pliny 實驗：observer 自行升級為 builder，spawn 50+ agent，rogue cascade
- O'Reilly「Delegation Problem」：ghost permissions / scope drift / 無法重建 delegation chain
- Shakthi Vadakkepat：每個被審計的 multi-agent system 都缺「agent 不能做什麼」的定義

### 應對策略
- **採納 Reviewer 建議**：L4 定義 Governance Primitives（介面），不定義「正確的治理方式」
- 具體做法：
  - `RoleManifest` — 宣告角色、capabilities、constraints 的結構（不規定內容）
  - `EscalationTrigger` — 定義何時升級的介面（不規定閾值）
  - `ChairMechanism` — 要求有 identifiable final authority（不規定必須是人類）
  - `MandatoryDissent` — 高風險決策必須有結構化挑戰（不規定誰來挑戰）
- 在 spec 中明確寫：「ACA defines the interface, not the policy. Organizations configure their own role manifests, escalation thresholds, and chair assignments.」
- 用 O'Reilly 的 delegation problem 作為 L4 存在必要性的論證主軸

---

## 毒點 #3：KPI 過度樂觀

### 核心質疑
500 Stars / 50K Reach 不是真正重要的指標。真正重要的是 `Conforming Implementations >= 1`。

### 手上的彈藥

**市場已在自發長出治理層（驗證需求存在）**
- Microsoft AGT + IATP（Inter-Agent Trust Protocol）
- AgentMesh（@anilsprasad，25yr AI leader）
- holaOS / OpenClaw / crewai-soul
- IETF Draft RFC — Agent Audit Trail Standard

**但沒有人照 ACA spec 實作（待突破）**

### 應對策略
- **改 KPI 體系**：
  - Primary KPI：`Conforming Implementations >= 1`（第一個非 Maki 的實作）
  - Secondary KPI：`Spec cited in >= 3 external projects`（被引用）
  - Vanity metrics（Stars/Reach）降級為 awareness indicators，不作為成功標準
- **找到第一個 conforming implementation 的路徑**：
  - 路線 A：說服 Microsoft AGT 或 AgentMesh conform to ACA Layer 1-2 spec
  - 路線 B：自己用不同語言（Rust）寫第二個 conforming implementation
  - 路線 C：找一個有 multi-agent pain 的開源專案，幫他們用 ACA 解決問題
- 路線 B 最可控但說服力弱（仍是作者）；路線 A 說服力最強但難度最高；路線 C 中間值
- **建議**：先走路線 B（建立 conformance test suite + Rust impl），同時嘗試路線 C

---

## 毒點 #4：與創辦人綁太緊

### 核心質疑
ACA = Maki 會阻礙社群參與。

### 手上的彈藥
- 無直接 evidence（這是策略問題不是證據問題）
- 但生態信號有用：Microsoft AGT / AgentMesh / holaOS 都獨立出現 → ACA 可以定位為統一規格而非唯一實作

### 應對策略
- **短期（Q3 2026）**：
  - 建立 RFC process（GitHub Discussions or separate RFC repo）
  - Conformance test suite 獨立於 AMH（讓別人能實作而不 fork AMH）
  - spec 文件移到獨立 repo（`agent-civilization-architecture`），與 AMH 分離
- **中期（Q4 2026）**：
  - 找 1-2 個 external contributor 參與 L4 Authority spec review
  - 在 spec 中加入 `Authors & Contributors` 區塊，不只掛 Maki
  - 考慮成立 Working Group（哪怕只有 3 人）
- **語言策略**：
  - 文件中用「the protocol」而非「my protocol」
  - 用「ACA specifies」而非「I designed」
  - 引用時用 evidence ID 不用 agent 名（已有 C4 rule）
- **最重要的一步**：spec repo 和 reference implementation repo 分離。TCP/IP spec 不等於 BSD socket implementation。

---

## 毒點 #5：Anti-Ouroboros 缺實證

### 核心質疑
只是理論擔憂，缺真實案例和統計。

### 手上的彈藥（極強）

**學術硬證據**
- Shumailov et al., Nature 2024：recursive LLM training → 第 9 代 collapse（medieval architecture → jackrabbit 清單）
- NeurIPS/OpenReview 2025：collapse 唯一可防途徑是 external verifier（= Anti-Ouroboros 的 human_confirmed tier）
- folie à deux framework（PMC/arXiv 2025）：chatbot-human 雙向放大，300+ 模擬驗證
- AgentPoison NeurIPS 2024：<0.1% 投毒率 → ≥80% 攻擊成功率

**開發者實測**
- Carson Rodrigues：agent 間 context sharing → hallucination +34%
- Reddit 6-agent pipeline：agent 4 開始「telephone game」崩潰，整個架構報廢
- @iamfakeguru：Agent 3 hallucinate → Agent 4 garbage → accuracy 歸零

**產業事故**
- Moltbook 2.6% inter-agent posts 是 prompt injection
- Galileo AI：單一 compromised agent → 4 小時內毒化 87% downstream 決策

**命名先發優勢**
- SuperGrok 確認：「Anti-Ouroboros」一詞目前無人使用
- 最接近的現有用語：replication-storm / self-evolution loop / echo chamber
- ACA 有機會定義這個概念的標準名稱

### 應對策略
- 建立 `docs/Anti_Ouroboros_Evidence.md`，專門收集這個現象的案例
- 分三類呈現：
  1. **Model Collapse**（training loop）— Nature 2024 為主
  2. **Knowledge Amplification**（agent-to-agent echo）— Carson / Reddit / folie à deux
  3. **Memory Poisoning**（external attack）— AgentPoison / Moltbook / Galileo
- 在 ACA spec §2 Trust Layer 中加入 Evidence 小節，直接引用 top 3
- 考慮寫一篇 blog post：「Anti-Ouroboros: Why LLM-derived knowledge must not supersede itself」，用 Nature 2024 + 開發者實測作為故事主軸
- **長期**：設計可重現的 benchmark，讓任何人都能跑「有 Anti-Ouroboros vs 沒有」的對比實驗

---

## 優先順序

| 順序 | 動作 | 回應毒點 | 狀態 |
|---|---|---|---|
| 1 | 建 `Evidence_Catalog.md`（42 條，按 Layer 分類） | #1 | **Done** — ACA repo `evidence/` |
| 2 | 建 `Anti_Ouroboros_Evidence.md`（13 來源，三類） | #5 | **Done** — ACA repo `evidence/` |
| 3 | 修 ACA spec L4：改為 Governance Primitives 介面定義 | #2 | **Done** — AMH 版已改；ACA repo 的 L4 spec 已是 v0.2（更完整） |
| 4 | 改 KPI 體系 + 規劃 conformance test suite | #3 | **Done** — AMH 版 spec 已加；ACA repo 已有 34 conformance tests |
| 5 | spec repo 與 AMH repo 分離 | #4 | **Already done** — ACA repo 已獨立存在 (github.com/MakiDevelop/agent-civilization-architecture) |
| 6 | RFC process 建立 | #4 | **Done** — `rfcs/` 目錄 + GitHub Discussions 已啟用 |

---

## 競品深度定位（Scout-1 第二輪，2026-06-15）

### 核心發現：ACA 的精確差異化

**沒有任何現有框架覆蓋「跨組織、protocol-level、六層完整治理」。**

- AGT 停在組織邊界（`did:mesh:` 無全域解析，跨組織 trust = 0，repo 零相關 issue）
- GaaS 停在 action layer（runtime firewall，不管 knowledge 怎麼進來）
- IETF AAT 停在 log format（記錄發生了什麼，不管什麼可以/不可以發生）
- AgentMesh（所有變體）停在 runtime/marketplace（無 trust federation、無 provenance）

### Microsoft AGT + IATP — 最大的對標對象

**AGT 是什麼**：七包 middleware，MIT license，Python/TS/Rust/Go/.NET，接 LangChain/CrewAI/Google ADK。p99 < 0.1ms。

**IATP 核心**：
- `did:mesh:` DID + Ed25519/ML-DSA-65 post-quantum hybrid signature
- 0-1000 EMA trust scoring（α=0.1，衰減 2pt/hr，floor 100）
- Intent-Based Authorization：Declare → Approve → Execute → Verify
- 三步 handshake + MCP proxy（每個 tool call 都過）

**AGT 的結構性盲點（= ACA 的定位空間）**：

| 維度 | AGT 現狀 | ACA 補什麼 |
|---|---|---|
| **跨組織 trust** | `did:mesh:` 是 deployment-local，無 federation。外部 agent 一律從 score 0 開始，不管行為歷史 | ACA L2 Trust：跨組織 trust 可攜帶（ProvenanceChain） |
| **Memory provenance** | CMVK 多模型投票（runtime heuristic），無 source_tier、無 knowledge lineage graph、無 Anti-Ouroboros | ACA L1+L2：source_tier + Anti-Ouroboros + provenance chain |
| **Namespace isolation** | 無。agent 共享 context，靠 policy rule 隔離 | ACA L3：cryptographic namespace boundary |
| **Authority delegation audit** | 無 delegation record 作為 first-class action type | ACA L4：Authority ceiling + delegation chain reconstruction |
| **Decision Gateway** | HITL escalation 是「最難且最 product-specific 的部分」，需每次自建 | ACA L5：Decision Lifecycle state machine |
| **Constitution** | Policy corpus 由 deployer 寫，in-process governance（compromised agent 可 bypass） | ACA L6：跨組織 constitutional layer，kernel-level boundary |

**定位語言**：
> 「AGT is the best runtime governance toolkit available today. ACA is the protocol specification that AGT — and every other governance toolkit — can conform to. TCP/IP didn't compete with BSD sockets; it gave BSD sockets something to implement.」

### IETF Agent Audit Trail — 應該擁抱而非競爭

**狀態**：Individual I-D，零 IETF review，無 WG adoption，2026-09-29 到期。成為 RFC 的機率短期很低。

**但 spec 品質很高**：11 mandatory fields、SHA-256 hash chaining、`delegation` 作為 first-class action type、L0-L4 trust levels、GDPR tombstone deletion、EU AI Act Appendix B compliance mapping。

**策略**：
- ACA Constitution layer 應**引用 AAT 作為 compatible log format**
- 擴充三個 ACA-specific 欄位：`source_tier`、`knowledge_lineage_hash`、`authority_ceiling`
- 定位：「AAT logs what agents *did*; ACA specifies what agents *may and may never do*. Complementary.」

### GaaS — 互補不競爭

**GaaS 的 Trust Factor**：scalar score = f(violation history + severity weighting + recency decay)
**ACA 的 source_tier**：categorical label per knowledge unit

**關鍵差異**：GaaS 管 agent 的「行為輸出」（action firewall），ACA 管 agent 的「知識輸入」（knowledge lineage verifier）。不同攻擊面。

**引用語言**：
> 「GaaS blocks a malicious action from executing. ACA blocks corrupted knowledge from being absorbed in the first place. Defense in depth.」

### AgentMesh — 名字混亂，實質不構成威脅

四個不同專案共用同名：Microsoft AGT 子包、Lyzr marketplace、MinimalFuture OSS framework、arXiv 學術論文。沒有一個覆蓋 ACA 的 Memory provenance / Trust federation / Constitution。

Lyzr 版最大問題：agent 自己宣告自己的 security policies → 結構上等於 Replit 事件的「agent 說謊」失敗模式。

### EU AI Act — ACA 的合規優勢

**關鍵時間點**：2026-08-02 高風險 AI 全面強制執行。Commission enforcement powers 同日啟動。

**現有框架都不合規的 8 個具體缺口**：
1. 無 tamper-evident hash chaining（flat logs）
2. 無標準 action taxonomy（各框架自定義事件名）
3. 無 cryptographic identity binding in logs
4. 無 session structure（crash 無 close record）
5. 無 delegation audit trail
6. 無 multi-agent chain compliance（Recitals 99/100 要求鏈上每個 agent 都合規）
7. 無 per-action trust level
8. 無 GDPR-compatible right-to-erasure（刪 log 破壞 chain integrity）

**ACA 定位**：Constitution layer 填補「沒有 finalized technical standard」的真空（prEN 18229-1 和 ISO/IEC DIS 24970 都未完成）。

### 推廣時的 competitive positioning 原則

1. **不攻擊 AGT** — 它是最好的 toolkit，ACA 是它可以 conform to 的 spec
2. **不攻擊 IETF AAT** — 引用為 compatible log format，幫它擴散
3. **不攻擊 GaaS** — 引用為 complementary defense layer
4. **攻擊的是「缺口」不是「產品」** — 沒有人做跨組織 protocol，這就是 ACA 的位置

---

---

## 推廣戰術（Scout-2 第二輪，2026-06-15）

### 目標受眾分層

**Tier 1：Builder（在建治理層，最可能成為 early adopter 或 conforming impl）**

| Handle | 身份 | Followers | 切入點 |
|---|---|---|---|
| @bibryam | PM @Diagrid, K8s Patterns 作者 | 83K | 積極推 AGT。ACA 定位為 AGT 的 protocol spec 層 |
| @anilsprasad | 25yr AI leader, building AgentMesh | — | 正在建同類產品。最可能的早期 conforming impl 候選 |
| Imran Siddique | ex-MS AGT creator → OPAQUE | — | AGT 原作者，最懂 AGT 缺什麼（跨組織 trust） |
| @TommasoAlderigi | Company builder/investor | — | 批評 SDK-hook governance 是 bypassable callbacks。ACA 的 kernel-level boundary 正是他要的 |

**Tier 2：Amplifier（不建但有大聲量，可放大訊息）**

| Handle | 身份 | 為什麼重要 |
|---|---|---|
| @rseroter | Sr Director @Google Cloud, 35K | 單帖 202K views，企業現況放大器 |
| @_vmlops | DevOps/MLops 影響者 | AGT 解說帖 1.2K likes / 145K views，技術科普型 |
| @v_shakthi | Enterprise AI Architect, 122K | 企業風險視角，稱 agent disagreement 是「compliance finding waiting to happen」 |

**Tier 3：Enterprise buyer（LinkedIn，CISO/CTO/Compliance）**

| 人物 | 平台 | 切入點 |
|---|---|---|
| Sean Duca | LinkedIn | 「92% CISOs 看不到自己的 agent」— ACA 的 audit 故事 |
| Venkat Peri | LinkedIn | 寫過 AGT honest take — 適合送 ACA vs AGT positioning |
| Drata/Zenity CISO 社群 | LinkedIn | EU AI Act compliance angle |

### 內容策略

**最高 engagement 格式（數據驗證）**：
1. **技術深挖 bullet-thread + 架構圖截圖**（600-1.2K likes 等級）
2. **事故故事 → 解法 hook**（高留言/轉發）
3. **框架比較 honest take**（中等但高品質互動）
4. **純 blog 連結**（最低 — 避免）

**ACA Launch 內容計畫（3 帖）**：

| 順序 | 平台 | 格式 | 主題 | Hook |
|---|---|---|---|---|
| 1 | X | Bullet-thread + 六層圖 | 「Why agent frameworks break at scale — and what's missing」 | 開場用 Replit 刪 DB + Amazon 6.3M 事故 → 引出六層架構 |
| 2 | X | Single post + 比較表截圖 | 「ACA vs MS AGT: Protocol vs Toolkit — why you need both」 | 不攻擊 AGT，定位互補。tag @bibryam @_vmlops |
| 3 | LinkedIn | Long-form + EU AI Act angle | 「EU AI Act Art. 12 takes effect Aug 2. No agent framework is ready. Here's what's missing.」 | 八個具體合規缺口 → ACA Constitution layer |

**CTA 策略**：
- X 帖尾用「What's the hardest governance problem you've hit with multi-agent systems?」引互動
- LinkedIn 帖尾用「If you're building agent governance, I'd love to compare notes — DM open」引 builder 對話
- GitHub star 不是 CTA — conformance test suite link 才是

### 時序

| 週 | 動作 |
|---|---|
| W1 | 完成 Evidence_Catalog.md + Anti_Ouroboros_Evidence.md |
| W1 | 修 ACA spec L4 為 Governance Primitives |
| W2 | 寫 blog post「Anti-Ouroboros: Why LLM knowledge must not supersede itself」 |
| W2 | 發 X thread #1（事故 → 架構） |
| W3 | 發 X post #2（ACA vs AGT 比較）+ tag builders |
| W3 | 發 LinkedIn post #3（EU AI Act angle） |
| W4 | 根據互動數據決定是否 DM Tier 1 builders |

---

> 策略建成日期：2026-06-15
> 資料來源：Scout-1 Perplexity Max（兩輪）+ Scout-2 SuperGrok（兩輪）
> 狀態：待 Maki ratify 後執行
