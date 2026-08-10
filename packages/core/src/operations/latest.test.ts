import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync } from "node:fs";
import { SqliteStore } from "../store/sqlite.js";
import { MemhallStore } from "../store/memhall.js";
import { writeMemory } from "./write.js";
import { isStateLike, latestMemories } from "./latest.js";

describe("latestMemories", () => {
  const dbPath = "/tmp/amh-latest-test.db";

  it("isStateLike detects markers", () => {
    assert.equal(isStateLike("[state foo 2026-07-24] bar"), true);
    assert.equal(isStateLike("[wrap-up slug 2026-07-24] done"), true);
    assert.equal(isStateLike("random lesson about postgres"), false);
  });

  it("prefers state-like entries over older plain lessons", async () => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    const store = new SqliteStore(dbPath);
    const gate = {
      writeGate: true,
      namespaceIsolation: false,
      dedup: true,
      antiOuroboros: false,
    };

    await writeMemory(
      {
        agent_id: "claude",
        namespace: "project:latest-demo",
        memory_type: "lesson",
        content: "old related lesson about database",
        source_type: "agent",
        source_ref: "",
        source_tier: "llm_derived",
      },
      store,
      gate
    );

    await writeMemory(
      {
        agent_id: "claude",
        namespace: "project:latest-demo",
        memory_type: "lesson",
        content: "[state latest-demo 2026-07-24] resume here\nstatus: open\nnext: run tests\nartifact: ⏭️ none",
        source_type: "agent",
        source_ref: "",
        source_tier: "llm_derived",
      },
      store,
      gate
    );

    const results = await latestMemories(
      { namespace: "project:latest-demo", limit: 3 },
      store,
      { namespaceIsolation: false }
    );

    assert.ok(results.length >= 1);
    assert.ok(results[0]!.content.value.includes("[state latest-demo"));

    unlinkSync(dbPath);
  });

  it("hides a superseded record on the sqlite path", async () => {
    const p = "/tmp/amh-latest-lifecycle.db";
    if (existsSync(p)) unlinkSync(p);
    const store = new SqliteStore(p);
    const gate = {
      writeGate: true,
      namespaceIsolation: false,
      dedup: true,
      antiOuroboros: false,
    };
    const base = {
      agent_id: "claude",
      namespace: "project:lifecycle",
      memory_type: "lesson" as const,
      source_type: "agent" as const,
      source_ref: "",
      source_tier: "llm_derived" as const,
    };

    const old = await writeMemory(
      { ...base, content: "[state lifecycle 2026-08-10] 舊狀態\nstatus: open\nblocker: 舊的阻塞\nartifact: ⏭️ none" },
      store,
      gate
    );
    await writeMemory(
      {
        ...base,
        content: "[state lifecycle 2026-08-10] 新狀態\nstatus: open\nblocker: 無\nartifact: ⏭️ none",
        supersedes: old.memory_id,
      },
      store,
      gate
    );

    const results = await latestMemories(
      { namespace: "project:lifecycle", limit: 10 },
      store,
      { namespaceIsolation: false }
    );

    assert.equal(results.some((r) => r.content.value.includes("舊的阻塞")), false);
    assert.equal(results.every((r) => r.status === "active"), true);

    unlinkSync(p);
  });
});

/**
 * 2026-08-10 回歸：latestMemories 的 memhall 分支直接呼叫 store.listLatest，
 * 繞過 queryMemories，因而沒有套 applyLifecycleFilter —— superseded 的記錄
 * 會被 boot 當成現況，把已作廢的 blocker / artifact 帶回接班視窗。
 * sqlite 分支一直是對的，所以只有正式 memhall backend 會中。
 */
describe("latestMemories — memhall path lifecycle filter", () => {
  const BASE = "https://memhall.example.test";
  const originalFetch = globalThis.fetch;

  function entry(id: string, content: string, amhStatus?: string) {
    return {
      entry_id: id,
      agent_id: "claude",
      namespace: "home",
      type: "lesson",
      content,
      created_at: "2026-08-10T09:00:00Z",
      created_by_principal: "bearer-user",
      content_hash: `sha256:${id}`,
      metadata: amhStatus ? { amh_status: amhStatus } : {},
    };
  }

  beforeEach(() => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v1/memory?")) {
        return new Response(
          JSON.stringify({
            entries: [
              entry("new-active", "[state x 2026-08-10] 新狀態\nblocker: 無"),
              entry("old-superseded", "[state x 2026-08-10] 舊狀態\nblocker: 舊的阻塞", "superseded"),
              entry("gone-revoked", "[state x 2026-08-10] 撤銷\nblocker: 撤銷的阻塞", "revoked"),
              entry("stale-expired", "[state x 2026-08-10] 過期\nblocker: 過期的阻塞", "expired"),
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200 });
    }) as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("filters out records inactive by amh_status (superseded / revoked / expired)", async () => {
    const store = new MemhallStore(BASE, "token");
    const results = await latestMemories({ namespace: "home", limit: 10 }, store, {
      namespaceIsolation: false,
    });

    assert.equal(results.length, 1);
    assert.equal(results[0]!.memory_id, "new-active");
    for (const stale of ["舊的阻塞", "撤銷的阻塞", "過期的阻塞"]) {
      assert.equal(
        results.some((r) => r.content.value.includes(stale)),
        false,
        `${stale} 不應出現在接班視窗`
      );
    }
  });

  it("keeps inactive records when filterInactive is explicitly false", async () => {
    const store = new MemhallStore(BASE, "token");
    const results = await latestMemories({ namespace: "home", limit: 10 }, store, {
      namespaceIsolation: false,
      filterInactive: false,
    });

    assert.equal(results.length, 4);
  });

  it("fails closed when namespaceIsolation is on but no caller namespace is set", async () => {
    const store = new MemhallStore(BASE, "token");
    await assert.rejects(
      () =>
        latestMemories({ namespace: "home", limit: 10 }, store, {
          namespaceIsolation: true,
        }),
      /CallerNamespaceRequiredError|no trusted caller_namespace/
    );
  });

  it("throws NamespaceViolationError on cross-namespace access instead of silently filtering", async () => {
    const store = new MemhallStore(BASE, "token");
    await assert.rejects(
      () =>
        latestMemories({ namespace: "home", limit: 10 }, store, {
          namespaceIsolation: true,
          callerNamespace: "project:other",
        }),
      /Namespace isolation/
    );
  });
});

/**
 * 2026-08-10 Codex review 發現 #1：entryToAmh() 沒有把 metadata.valid_until 還原回
 * AmhRecord.valid_until，所以 isExpired() 的「時間到期」語義在 memhall backend 上
 * 從未生效 —— 只有 amh_status === "expired" 會被擋。
 */
describe("latestMemories — memhall valid_until hydration", () => {
  const BASE = "https://memhall.example.test";
  const originalFetch = globalThis.fetch;

  function entry(id: string, validUntil?: string) {
    return {
      entry_id: id,
      agent_id: "claude",
      namespace: "home",
      type: "lesson",
      content: `[state x 2026-08-10] ${id}\nblocker: 無`,
      created_at: "2026-08-10T09:00:00Z",
      created_by_principal: "bearer-user",
      content_hash: `sha256:${id}`,
      // status 刻意保持 active —— 重點是時間到期，不是 status
      metadata: validUntil ? { amh_status: "active", valid_until: validUntil } : { amh_status: "active" },
    };
  }

  beforeEach(() => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v1/memory?")) {
        return new Response(
          JSON.stringify({
            entries: [
              entry("no-expiry"),
              entry("still-valid", "2099-01-01T00:00:00Z"),
              entry("past-due", "2020-01-01T00:00:00Z"),
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200 });
    }) as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("hydrates valid_until so time-based expiry actually applies", async () => {
    const store = new MemhallStore(BASE, "token");
    const results = await latestMemories({ namespace: "home", limit: 10 }, store, {
      namespaceIsolation: false,
    });

    const ids = results.map((r) => r.memory_id);
    assert.equal(ids.includes("past-due"), false, "已過 valid_until 的記錄不應回傳");
    assert.equal(ids.includes("still-valid"), true, "未來的 valid_until 應保留");
    assert.equal(ids.includes("no-expiry"), true, "沒有 valid_until 應保留");
    assert.equal(
      results.find((r) => r.memory_id === "still-valid")!.valid_until,
      "2099-01-01T00:00:00Z"
    );
  });
});

/**
 * 20 筆視窗的已知限制（BL-003）：listLatest 的 limit 只放大到 max(limit, 20)，
 * 過濾在記憶體內做。若最近 20 筆皆 inactive，會回傳空陣列而非往前找。
 * 這條測試「固定目前已知行為」，不是主張它是對的 —— 正解是 cursor pagination。
 */
describe("latestMemories — 20-record window limitation (BL-003, known)", () => {
  const BASE = "https://memhall.example.test";
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v1/memory?")) {
        const entries = Array.from({ length: 20 }, (_, i) => ({
          entry_id: `superseded-${i}`,
          agent_id: "claude",
          namespace: "home",
          type: "lesson",
          content: `[state x 2026-08-10] 舊 ${i}\nblocker: 無`,
          created_at: "2026-08-10T09:00:00Z",
          created_by_principal: "bearer-user",
          content_hash: `sha256:s${i}`,
          metadata: { amh_status: "superseded" },
        }));
        return new Response(JSON.stringify({ entries }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    }) as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns empty when the whole window is inactive (documents current behaviour)", async () => {
    const store = new MemhallStore(BASE, "token");
    const results = await latestMemories({ namespace: "home", limit: 5 }, store, {
      namespaceIsolation: false,
    });
    // 已知限制：不保證補滿 limit，也不會往前翻頁找第 21 筆的 active state
    assert.equal(results.length, 0);
  });
});
