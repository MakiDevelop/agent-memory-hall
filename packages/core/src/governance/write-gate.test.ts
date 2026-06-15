import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { unlinkSync, existsSync } from "node:fs";
import { writeMemory } from "../operations/write.js";
import { SqliteStore } from "../store/sqlite.js";

describe("write_gate config", () => {
  const dbPath = "/tmp/amh-write-gate-test.db";

  it("skips governance when write_gate is disabled", async () => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    const store = new SqliteStore(dbPath);

    const result = await writeMemory(
      {
        agent_id: "planner",
        namespace: "project:any",
        memory_type: "fact",
        content: "ungated write",
        source_type: "agent",
        source_ref: "",
        source_tier: "llm_derived",
      },
      store,
      {
        writeGate: false,
        namespaceIsolation: true,
        dedup: true,
        antiOuroboros: true,
      }
    );

    assert.deepEqual(result.governance_applied, []);

    unlinkSync(dbPath);
  });
});