# LinkedIn Post（中文版）

---

我花了兩個月，讓七個 AI Agent 共用一套記憶系統。

然後我把學到的東西，做成了一個開源協議。

---

先說問題。

現在的 AI Agent 什麼都能做——呼叫工具（MCP）、互相溝通（A2A）、驗證身份（DID）。

但你問它昨天做了什麼決定，它一臉茫然。

Agent 記憶是壞的。不是存不住——Mem0、Zep、Letta 都能存。壞在：

→ 換框架 = 記憶歸零
→ Agent A 做了決定，Agent B 不知道
→ LLM 拿自己的摘要再摘要，三輪就飄掉（我叫它「銜尾蛇問題」）
→ 沒人知道這筆記憶誰寫的、什麼時候該忘、誰有權刪

這四個問題，我全踩過。

---

我的場景：一個七人 AI 團隊（Claude、Codex、Gemini、Grok、gemma4、Perplexity Max、SuperGrok），在我自建的記憶系統 memhall 上協作了 60+ 個 session。

踩坑之後的四個教訓：

1️⃣ 不去重，記憶三天就爆。Agent 超愛重複記同一件事。加了 content hash 去重，儲存量少 40%。

2️⃣ LLM 生成的記憶很危險。它會拿上次的摘要當事實，再生一份新摘要。三輪後離原始事實越來越遠。解法：每筆記憶標 source_tier（raw_source / llm_derived / human_confirmed），禁止 llm_derived 覆蓋 llm_derived。

3️⃣ 命名空間隔離不是選配。七個 Agent 共用一個記憶庫，不加牆就是災難。A 的工作記憶不該洩漏到 B 的上下文。

4️⃣ 每筆記憶都要有來歷。「誰寫的？什麼時候？根據什麼？」答不出來的記憶，比沒有記憶更危險——那是帶引用的幻覺。

---

所以我把這些教訓做成了 Agent Memory Hall（AMH）——一個開源的 Agent 記憶治理協議。

AMH 不是記憶儲存，不是框架，不跟 Mem0 或 Letta 競爭。

AMH 是治理層。定義記憶怎麼寫入、傳遞、過期、審計。任何框架都能實作，任何儲存都能接。

核心：14 個欄位、4 個操作、4 個治理預設（去重、反銜尾蛇、命名空間隔離、來源層級驗證）。

一行啟動：
npx @chibakuma/agent-memory-hall

已上架 npm，MCP server 直接接 Claude Desktop / Cursor / Codex。

---

跟 UMP（Universal Memory Protocol）的差異：

UMP 定義格式。AMH 出帶治理的工具。

UMP 的 governance 是選配（L3 才有 integrity）。AMH 的 governance 是預設——因為我們從實戰學到：不治理的記憶，幾週內就退化成垃圾。

兩者可以共存。AMH 能匯入匯出 UMP 格式。

---

現在可以用的：
✅ npm: @chibakuma/agent-memory-hall v0.1.0
✅ MCP server（5 個 tools）
✅ UMP / Mem0 匯入轉接器
✅ 白皮書（5 章、10 篇引用）
✅ GitHub: github.com/MakiDevelop/agent-memory-hall

接下來做：
→ SQLite adapter（七月）
→ LoCoMo benchmark + 公開 judge prompt（八月）
→ Multi-agent 開發團隊案例（九月）
→ v1.0 spec freeze + community RFC（十月）

---

我相信的事：

MCP 標準化了 Agent 怎麼用工具。
A2A 標準化了 Agent 怎麼對話。
下一個要標準化的，是 Agent 怎麼記憶。

現在這個領域是碎片化的——五個叫 AMP 的專案、一個兩人推的 UMP、一個四人的 W3C 社群小組、還有一百個開發者在自己造輪子。

我賭的是：贏家不會是理論上最完整的規格書，而是第一個把治理做成預設的。

因為不治理的記憶——就像不治理的任何東西——最終都會退化成混亂。

程式碼開源。規格免費。記憶是你的。

#AIAgent #AgentMemory #MCP #OpenSource #AgentMemoryHall #MultiAgent #LLM #AI

---

英文版 blog：https://blog.chibakuma.com/ump-defines-the-wire-amh-ships-the-governance/
GitHub：https://github.com/MakiDevelop/agent-memory-hall
npm：https://www.npmjs.com/package/@chibakuma/agent-memory-hall
