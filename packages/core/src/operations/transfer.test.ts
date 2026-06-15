import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { unlinkSync, existsSync } from "node:fs";
import { writeMemory } from "./write.js";
import { transferMemory } from "./transfer.js";
import { readMemory } from "./read.js";
import { SqliteStore } from "../store/sqlite.js";
import { NamespaceViolationError } from "../governance/namespace.js";

describe("transfer source authorization", () => {
  const dbPath = "/tmp/amh-transfer-test.db";

  it("cannot transfer memory from another namespace", async () => {
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
        transferMemory(
          {
            memory_id: secret.memory_id,
            target_namespace: "project:acme",
            target_agent: "agent-b",
            transferred_by: "agent-b",
          },
          store,
          { namespaceIsolation: true },
          { callerNamespace: "project:acme" }
        ),
      /Memory not found/
    );

    unlinkSync(dbPath);
  });

  it("transfers within caller namespace", async () => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    const store = new SqliteStore(dbPath);

    const source = await writeMemory(
      {
        agent_id: "agent-a",
        namespace: "project:acme",
        memory_type: "fact",
        content: "shared fact",
        source_type: "agent",
        source_ref: "",
        source_tier: "llm_derived",
      },
      store,
      { namespaceIsolation: true },
      { callerNamespace: "project:acme" }
    );

    const result = await transferMemory(
      {
        memory_id: source.memory_id,
        target_namespace: "project:acme",
        target_agent: "agent-b",
        transferred_by: "agent-b",
      },
      store,
      { namespaceIsolation: true, dedup: false },
      { callerNamespace: "project:acme" }
    );

    const transferred = await readMemory(result.new_memory_id, store, {
      callerNamespace: "project:acme",
      namespaceIsolation: true,
    });
    assert.ok(transferred);
    assert.equal(transferred.agent_id, "agent-b");
    assert.equal(transferred.content.value, "shared fact");
    assert.equal(transferred.provenance_chain?.origin.memory_id, source.memory_id);
    assert.equal(transferred.provenance_chain?.transitions[0]?.type, "transfer");
    assert.equal(transferred.provenance_chain?.transitions[0]?.from_memory_id, source.memory_id);
    assert.equal(transferred.provenance_chain?.transitions[0]?.to_memory_id, result.new_memory_id);

    unlinkSync(dbPath);
  });

  it("rejects cross-namespace target when isolation is enabled", async () => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    const store = new SqliteStore(dbPath);

    const source = await writeMemory(
      {
        agent_id: "agent-a",
        namespace: "project:acme",
        memory_type: "fact",
        content: "handoff candidate",
        source_type: "agent",
        source_ref: "",
        source_tier: "llm_derived",
      },
      store,
      { namespaceIsolation: true, dedup: false },
      { callerNamespace: "project:acme" }
    );

    await assert.rejects(
      () =>
        transferMemory(
          {
            memory_id: source.memory_id,
            target_namespace: "project:other",
            target_agent: "agent-b",
            transferred_by: "agent-b",
          },
          store,
          { namespaceIsolation: true, dedup: false },
          { callerNamespace: "project:acme" }
        ),
      NamespaceViolationError
    );

    unlinkSync(dbPath);
  });
});
