# LinkedIn Post（中文版）

---

最近在嘗試讓多個 AI Agent 共用記憶系統，踩了不少坑，整理出來跟大家分享。

---

現在的 AI Agent 能呼叫工具（MCP）、互相溝通（A2A）、驗證身份（DID），功能越來越強。

但有一個基本問題還沒解決：Agent 的記憶。

換個框架，記憶就歸零。Agent A 做了決定，Agent B 不知道。LLM 拿自己的摘要再摘要，幾輪就偏掉了。沒人知道一筆記憶是誰寫的、什麼時候該忘、誰有權刪。

---

我的背景是這樣：過去兩個月，我在自建的記憶系統 memhall 上跑了一個多 Agent 團隊（Claude、Codex、Gemini 等），累積了 60 多個協作 session。

過程中學到幾件事，分享給也在做 multi-agent 的朋友：

1️⃣ 不做去重，記憶很快就爆。Agent 很容易重複記同一件事。加了 content hash 去重後，儲存量明顯改善。

2️⃣ LLM 生成的記憶需要特別小心。它會拿上次的摘要當事實，再生新摘要。幾輪之後就偏離原始事實了。我們的做法是給每筆記憶標 source_tier（原始來源 / LLM 生成 / 人工確認），禁止 LLM 生成的記憶互相覆蓋。

3️⃣ 命名空間隔離很重要。多個 Agent 共用一個記憶庫，如果不隔離，A 的工作記憶會洩漏到 B 的上下文。

4️⃣ 每筆記憶都需要來源追蹤。「誰寫的？什麼時候？根據什麼？」這些問題答不出來，記憶就不可信。

---

基於這些經驗，我把常用的治理邏輯整理成了 Agent Memory Hall（AMH）——一個開源的 Agent 記憶治理工具。

它不是記憶儲存，也不是要取代 Mem0 或 Letta。它比較像是一個治理層：定義記憶怎麼寫入、傳遞、過期、審計，任何框架都能接。

目前是 v0.3，還在早期，但已經可以用了：

單 Agent（零設定）：
npx @chibakuma/agent-memory-hall
→ SQLite 存在 ~/.amh/memory.db，開箱即用

多 Agent（Docker + Postgres）：
docker compose up -d
npx @chibakuma/agent-memory-hall --store postgres --path postgres://amh:amh@localhost:5432/amh

支援 MCP，可以直接接 Claude Desktop / Cursor。

---

跟目前比較接近的 UMP（Universal Memory Protocol）相比，UMP 偏重格式定義，AMH 偏重治理（去重、來源追蹤、命名空間隔離這些是預設開啟的）。兩者可以共存，AMH 支援 UMP 格式匯入匯出。

---

目前還很早期，歡迎有在做 multi-agent 系統的朋友一起看看、給 feedback：

📝 Blog（完整技術說明）：chiba.tw/amhblog
💻 GitHub：chiba.tw/amhgit
📦 npm：chiba.tw/amhnpm

如果你也踩過 Agent 記憶的坑，歡迎留言交流。

#AIAgent #AgentMemory #MCP #OpenSource #MultiAgent #LLM
