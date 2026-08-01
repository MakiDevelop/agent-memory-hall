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

  it("supersedes parent without silently claiming human confirmation", async () => {
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

    const replacement = await readMemory(child.memory_id, store, {
      namespaceIsolation: false,
    });
    assert.equal(replacement?.source.tier, "llm_derived");
    assert.equal(replacement?.source.type, "agent");
    assert.ok(child.governance_applied.includes("llm_to_llm_supersede"));

    const active = await listActiveKnowledge("project:k", store, {
      namespaceIsolation: false,
    });
    assert.ok(active.every((r) => r.status === "active"));
    assert.ok(active.some((r) => r.content.value.includes("PostgreSQL")));

    unlinkSync(dbPath);
  });

  it("honours an explicitly requested human_confirmed tier", async () => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    const store = new SqliteStore(dbPath);
    const gate = {
      writeGate: true,
      namespaceIsolation: false,
      dedup: true,
      antiOuroboros: true,
    };

    const parent = await writeKnowledge(
      { agent_id: "codex", namespace: "project:k", content: "Deploy on Friday" },
      store,
      gate
    );

    const child = await writeKnowledge(
      {
        agent_id: "maki",
        namespace: "project:k",
        content: "Never deploy on Friday",
        supersedes: parent.memory_id,
        source_tier: "human_confirmed",
      },
      store,
      gate
    );

    const replacement = await readMemory(child.memory_id, store, {
      namespaceIsolation: false,
    });
    assert.equal(replacement?.source.tier, "human_confirmed");
    assert.equal(replacement?.source.type, "human");
    // parent is llm_derived, child is not -> no relaxation marker
    assert.ok(!child.governance_applied.includes("llm_to_llm_supersede"));

    unlinkSync(dbPath);
  });
});
