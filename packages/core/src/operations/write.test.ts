import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeMemory } from "./write.js";
import { queryMemories } from "./read.js";
import { SqliteStore } from "../store/sqlite.js";
import { unlinkSync, existsSync } from "node:fs";
import { NamespaceViolationError } from "../governance/namespace.js";

describe("write + read integration", () => {
  const dbPath = "/tmp/amh-write-test.db";

  it("applies governance and namespace isolation", async () => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    const store = new SqliteStore(dbPath);

    const result = await writeMemory(
      {
        agent_id: "planner",
        namespace: "project:acme",
        memory_type: "decision",
        content: "Use PostgreSQL",
        source_type: "agent",
        source_ref: "session:1",
        source_tier: "llm_derived",
        caller_namespace: "project:acme",
      },
      store
    );

    assert.ok(result.memory_id);
    assert.deepEqual(result.governance_applied, [
      "namespace_isolation",
      "anti_ouroboros",
      "content_hash",
      "dedup",
    ]);

    const visible = await queryMemories(
      { namespace: "project:acme" },
      store,
      { callerNamespace: "project:acme", namespaceIsolation: true }
    );
    assert.equal(visible.length, 1);

    const hidden = await queryMemories(
      {},
      store,
      { callerNamespace: "project:other", namespaceIsolation: true }
    );
    assert.equal(hidden.length, 0);

    await assert.rejects(
      () =>
        queryMemories(
          { namespace: "project:acme" },
          store,
          { callerNamespace: "project:other", namespaceIsolation: true }
        ),
      NamespaceViolationError
    );

    await assert.rejects(
      () =>
        writeMemory(
          {
            agent_id: "planner",
            namespace: "project:secret",
            memory_type: "fact",
            content: "blocked",
            source_type: "agent",
            source_ref: "",
            source_tier: "llm_derived",
            caller_namespace: "project:acme",
          },
          store
        ),
      NamespaceViolationError
    );

    unlinkSync(dbPath);
  });
});