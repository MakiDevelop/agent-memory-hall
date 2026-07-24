import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteStore } from "../store/sqlite.js";
import { writeKnowledge, listActiveKnowledge } from "./knowledge.js";
import { readMemory } from "./read.js";

describe("writeKnowledge", () => {
  const dbPath = join(tmpdir(), `amh-knowledge-${Date.now()}.db`);

  it("supersedes parent with human_confirmed tier", async () => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    const store = new SqliteStore(dbPath);
    const gate = {
      writeGate: true,
      namespaceIsolation: false,
      dedup: true,
      antiOuroboros: true,
    };

    const parent = await writeKnowledge(
      {
        agent_id: "codex",
        namespace: "project:k",
        content: "Use MySQL for analytics",
      },
      store,
      gate
    );

    const child = await writeKnowledge(
      {
        agent_id: "codex",
        namespace: "project:k",
        content: "Use PostgreSQL for analytics",
        supersedes: parent.memory_id,
      },
      store,
      gate
    );

    assert.equal(child.superseded, parent.memory_id);
    const old = await readMemory(parent.memory_id, store, {
      namespaceIsolation: false,
      filterInactive: false,
    });
    assert.equal(old?.status, "superseded");

    const active = await listActiveKnowledge("project:k", store, {
      namespaceIsolation: false,
    });
    assert.ok(active.every((r) => r.status === "active"));
    assert.ok(active.some((r) => r.content.value.includes("PostgreSQL")));

    unlinkSync(dbPath);
  });
});
