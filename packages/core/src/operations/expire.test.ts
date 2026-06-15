import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { unlinkSync, existsSync } from "node:fs";
import { writeMemory } from "./write.js";
import { expireMemory } from "./expire.js";
import { revokeMemory } from "./revoke.js";
import { readMemory } from "./read.js";
import { getAuditLog } from "./audit.js";
import { SqliteStore } from "../store/sqlite.js";

describe("expireMemory", () => {
  const dbPath = "/tmp/amh-expire-test.db";

  async function seed(store: SqliteStore): Promise<string> {
    const created = await writeMemory(
      {
        agent_id: "agent-a",
        namespace: "project:acme",
        memory_type: "fact",
        content: "time bounded fact",
        source_type: "agent",
        source_ref: "",
        source_tier: "llm_derived",
      },
      store,
      { namespaceIsolation: true, dedup: false },
      { callerNamespace: "project:acme" }
    );
    return created.memory_id;
  }

  function freshStore(): SqliteStore {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    return new SqliteStore(dbPath);
  }

  it("expires active memory and hides it from default reads", async () => {
    const store = freshStore();
    const id = await seed(store);

    const result = await expireMemory(
      {
        memory_id: id,
        expired_by: "agent-a",
        reason: "ttl elapsed",
      },
      store,
      { namespaceIsolation: true },
      { callerNamespace: "project:acme" }
    );

    assert.equal(result.status, "expired");
    assert.equal(result.previous_status, "active");
    assert.equal(result.already_expired, false);

    const hidden = await readMemory(id, store, {
      callerNamespace: "project:acme",
      namespaceIsolation: true,
    });
    assert.equal(hidden, null);

    const expired = await readMemory(id, store, {
      callerNamespace: "project:acme",
      namespaceIsolation: true,
      filterInactive: false,
    });
    assert.equal(expired?.status, "expired");
  });

  it("is idempotent when memory is already expired", async () => {
    const store = freshStore();
    const id = await seed(store);

    await expireMemory(
      { memory_id: id, expired_by: "agent-a" },
      store,
      {},
      { callerNamespace: "project:acme" }
    );

    const again = await expireMemory(
      { memory_id: id, expired_by: "agent-a" },
      store,
      {},
      { callerNamespace: "project:acme" }
    );

    assert.equal(again.status, "expired");
    assert.equal(again.already_expired, true);
  });

  it("throws for non-existent memory", async () => {
    const store = freshStore();

    await assert.rejects(
      () =>
        expireMemory(
          { memory_id: "missing", expired_by: "agent-a" },
          store,
          {},
          { callerNamespace: "project:acme" }
        ),
      /Memory not found/
    );
  });

  it("throws for revoked memory", async () => {
    const store = freshStore();
    const id = await seed(store);

    await revokeMemory(
      { memory_id: id, revoked_by: "agent-a" },
      store,
      {},
      { callerNamespace: "project:acme" }
    );

    await assert.rejects(
      () =>
        expireMemory(
          { memory_id: id, expired_by: "agent-a" },
          store,
          {},
          { callerNamespace: "project:acme" }
        ),
      /Cannot expire non-active record: revoked/
    );
  });

  it("appends an expire audit event", async () => {
    const store = freshStore();
    const id = await seed(store);

    await expireMemory(
      { memory_id: id, expired_by: "agent-a", reason: "manual ttl" },
      store,
      {},
      { callerNamespace: "project:acme" }
    );

    const audit = await getAuditLog(id, store);
    const event = audit.find((e) => e.operation === "expire");
    assert.ok(event);
    assert.equal(event.principal_id, "agent-a");
    assert.equal(event.details, "manual ttl");
  });
});
