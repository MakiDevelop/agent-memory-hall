import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { unlinkSync, existsSync } from "node:fs";
import { writeMemory } from "../operations/write.js";
import { SqliteStore } from "../store/sqlite.js";
import { checkContentQuality, ContentQualityError } from "./write-gate.js";

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

  it("rejects placeholder content when write_gate on", async () => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    const store = new SqliteStore(dbPath);

    await assert.rejects(
      () =>
        writeMemory(
          {
            agent_id: "planner",
            namespace: "project:any",
            memory_type: "lesson",
            content: "test",
            source_type: "agent",
            source_ref: "",
            source_tier: "llm_derived",
          },
          store,
          {
            writeGate: true,
            namespaceIsolation: false,
            dedup: true,
            antiOuroboros: false,
          }
        ),
      (err: unknown) => err instanceof ContentQualityError || (err instanceof Error && err.name === "ContentQualityError")
    );

    unlinkSync(dbPath);
  });

  it("rejects pointer without artifact path", () => {
    assert.throws(
      () => checkContentQuality("[pointer foo] handoff missing path"),
      ContentQualityError
    );
  });

  it("accepts pointer with artifact path", () => {
    const tags = checkContentQuality(
      "[pointer foo]\nartifact: /Users/maki/Documents/handoff/README.md"
    );
    assert.ok(tags.some((t) => t.startsWith("kind_detect:pointer")));
  });

  it("warns on long state content", () => {
    const body = "x".repeat(900);
    const tags = checkContentQuality(`[state slug 2026-07-24] title\n${body}`);
    assert.ok(tags.some((t) => t.startsWith("state_length_warn:")));
  });
});