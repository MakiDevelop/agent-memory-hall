import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteStore } from "../store/sqlite.js";
import { writeMemory } from "./write.js";
import { ttlSweep } from "./ttl-sweep.js";
import { readMemory } from "./read.js";

describe("ttlSweep", () => {
  const dbPath = join(tmpdir(), `amh-ttl-${Date.now()}.db`);

  it("dry-run reports due; --apply expires", async () => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    const store = new SqliteStore(dbPath);
    const gate = {
      writeGate: true,
      namespaceIsolation: false,
      dedup: true,
      antiOuroboros: false,
    };

    const past = new Date(Date.now() - 86400000).toISOString();
    const w = await writeMemory(
      {
        agent_id: "claude",
        namespace: "project:ttl",
        memory_type: "lesson",
        content: "scratch note that should expire",
        source_type: "agent",
        source_ref: "",
        source_tier: "llm_derived",
        valid_until: past,
      },
      store,
      gate
    );

    const dry = await ttlSweep(store, {
      namespace: "project:ttl",
      dryRun: true,
    });
    assert.equal(dry.due, 1);
    assert.equal(dry.expired, 0);

    const applied = await ttlSweep(store, {
      namespace: "project:ttl",
      dryRun: false,
    });
    assert.equal(applied.expired, 1);

    const rec = await readMemory(w.memory_id, store, {
      namespaceIsolation: false,
      filterInactive: false,
    });
    assert.equal(rec?.status, "expired");

    unlinkSync(dbPath);
  });
});
