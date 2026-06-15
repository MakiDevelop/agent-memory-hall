import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { unlinkSync, existsSync } from "node:fs";
import { writeMemory } from "./write.js";
import { revokeMemory } from "./revoke.js";
import { readMemory, queryMemories } from "./read.js";
import { getAuditLog } from "./audit.js";
import { SqliteStore } from "../store/sqlite.js";

describe("revokeMemory", () => {
  const dbPath = "/tmp/amh-revoke-test.db";

  it("marks memory revoked and hides it from default reads", async () => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    const store = new SqliteStore(dbPath);

    const created = await writeMemory(
      {
        agent_id: "agent-a",
        namespace: "project:acme",
        memory_type: "fact",
        content: "temporary fact",
        source_type: "agent",
        source_ref: "",
        source_tier: "llm_derived",
      },
      store,
      { namespaceIsolation: true, dedup: false },
      { callerNamespace: "project:acme" }
    );

    const result = await revokeMemory(
      {
        memory_id: created.memory_id,
        revoked_by: "agent-a",
        reason: "no longer relevant",
      },
      store,
      { namespaceIsolation: true },
      { callerNamespace: "project:acme" }
    );

    assert.equal(result.status, "revoked");
    assert.equal(result.previous_status, "active");
    assert.equal(result.already_revoked, false);

    const hidden = await readMemory(created.memory_id, store, {
      callerNamespace: "project:acme",
      namespaceIsolation: true,
    });
    assert.equal(hidden, null);

    const listed = await queryMemories(
      { namespace: "project:acme" },
      store,
      { callerNamespace: "project:acme", namespaceIsolation: true }
    );
    assert.equal(listed.length, 0);

    const audit = await getAuditLog(created.memory_id, store);
    assert.equal(audit.some((e) => e.operation === "revoke"), true);

    unlinkSync(dbPath);
  });

  it("cannot revoke memory from another namespace", async () => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    const store = new SqliteStore(dbPath);

    const secret = await writeMemory(
      {
        agent_id: "agent-a",
        namespace: "project:secret",
        memory_type: "fact",
        content: "classified",
        source_type: "agent",
        source_ref: "",
        source_tier: "llm_derived",
      },
      store,
      { namespaceIsolation: true },
      { callerNamespace: "project:secret" }
    );

    await assert.rejects(
      () =>
        revokeMemory(
          {
            memory_id: secret.memory_id,
            revoked_by: "agent-b",
          },
          store,
          { namespaceIsolation: true },
          { callerNamespace: "project:acme" }
        ),
      /Memory not found/
    );

    unlinkSync(dbPath);
  });

  it("is idempotent when memory is already revoked", async () => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    const store = new SqliteStore(dbPath);

    const created = await writeMemory(
      {
        agent_id: "agent-a",
        namespace: "project:acme",
        memory_type: "fact",
        content: "gone",
        source_type: "agent",
        source_ref: "",
        source_tier: "llm_derived",
      },
      store,
      { dedup: false },
      { callerNamespace: "project:acme" }
    );

    await revokeMemory(
      { memory_id: created.memory_id, revoked_by: "agent-a" },
      store,
      {},
      { callerNamespace: "project:acme" }
    );

    const again = await revokeMemory(
      { memory_id: created.memory_id, revoked_by: "agent-a" },
      store,
      {},
      { callerNamespace: "project:acme" }
    );

    assert.equal(again.already_revoked, true);

    unlinkSync(dbPath);
  });
});