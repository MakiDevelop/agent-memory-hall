import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync } from "node:fs";
import { SqliteStore } from "../store/sqlite.js";
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
});
