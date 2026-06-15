import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { unlinkSync, existsSync } from "node:fs";
import { writeMemory } from "./write.js";
import { readMemory } from "./read.js";
import { SqliteStore } from "../store/sqlite.js";
import { AntiOuroborosError } from "../governance/source-tier.js";

describe("supersede authorization", () => {
  const dbPath = "/tmp/amh-supersede-test.db";

  it("cannot supersede memory in another namespace", async () => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    const store = new SqliteStore(dbPath);

    const secret = await writeMemory(
      {
        agent_id: "agent-a",
        namespace: "project:secret",
        memory_type: "fact",
        content: "old secret fact",
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
        writeMemory(
          {
            agent_id: "agent-b",
            namespace: "project:acme",
            memory_type: "fact",
            content: "replacement fact",
            source_type: "agent",
            source_ref: "",
            source_tier: "human_confirmed",
            supersedes: secret.memory_id,

          },
          store,
          { namespaceIsolation: true },
          { callerNamespace: "project:acme" }
        ),
      /not found or not accessible/
    );

    const parent = await readMemory(secret.memory_id, store, {
      callerNamespace: "project:secret",
      namespaceIsolation: true,
    });
    assert.equal(parent?.status, "active");

    unlinkSync(dbPath);
  });

  it("supersedes memory in same namespace", async () => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    const store = new SqliteStore(dbPath);

    const original = await writeMemory(
      {
        agent_id: "agent-a",
        namespace: "project:acme",
        memory_type: "fact",
        content: "old fact",
        source_type: "agent",
        source_ref: "",
        source_tier: "llm_derived",

      },
      store,
      { namespaceIsolation: true, dedup: false },
      { callerNamespace: "project:acme" }
    );

    const replacement = await writeMemory(
      {
        agent_id: "agent-b",
        namespace: "project:acme",
        memory_type: "fact",
        content: "updated fact",
        source_type: "agent",
        source_ref: "",
        source_tier: "human_confirmed",
        supersedes: original.memory_id,

      },
      store,
      { namespaceIsolation: true, dedup: false },
      { callerNamespace: "project:acme" }
    );

    const hidden = await readMemory(original.memory_id, store, {
      callerNamespace: "project:acme",
      namespaceIsolation: true,
    });
    assert.equal(hidden, null);

    const parent = await readMemory(original.memory_id, store, {
      callerNamespace: "project:acme",
      namespaceIsolation: true,
      filterInactive: false,
    });
    assert.equal(parent?.status, "superseded");

    const child = await readMemory(replacement.memory_id, store, {
      callerNamespace: "project:acme",
      namespaceIsolation: true,
    });
    assert.equal(child?.provenance_chain?.origin.memory_id, original.memory_id);
    assert.equal(child?.provenance_chain?.transitions[0]?.type, "supersede");
    assert.equal(child?.provenance_chain?.transitions[0]?.from_memory_id, original.memory_id);
    assert.equal(child?.provenance_chain?.transitions[0]?.to_memory_id, replacement.memory_id);

    unlinkSync(dbPath);
  });

  it("blocks llm_derived supersede of expired llm_derived parent", async () => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    const store = new SqliteStore(dbPath);

    const expired = await writeMemory(
      {
        agent_id: "agent-a",
        namespace: "project:acme",
        memory_type: "fact",
        content: "expired fact",
        source_type: "agent",
        source_ref: "",
        source_tier: "llm_derived",
        valid_until: "2020-01-01T00:00:00Z",

      },
      store,
      { namespaceIsolation: true, dedup: false },
      { callerNamespace: "project:acme" }
    );

    await assert.rejects(
      () =>
        writeMemory(
          {
            agent_id: "agent-b",
            namespace: "project:acme",
            memory_type: "fact",
            content: "replacement",
            source_type: "agent",
            source_ref: "",
            source_tier: "llm_derived",
            supersedes: expired.memory_id,

          },
          store,
          { namespaceIsolation: true, dedup: false },
          { callerNamespace: "project:acme" }
        ),
      AntiOuroborosError
    );

    unlinkSync(dbPath);
  });
});
