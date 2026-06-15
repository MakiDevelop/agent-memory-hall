import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeContentHash, checkDedup, DuplicateMemoryError } from "./dedup.js";
import { SqliteStore } from "../store/sqlite.js";
import { unlinkSync, existsSync } from "node:fs";

describe("dedup", () => {
  it("uses BLAKE3 hex digest", () => {
    const hash = computeContentHash("hello");
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]+$/);
    assert.equal(computeContentHash("hello"), computeContentHash("hello"));
    assert.notEqual(computeContentHash("hello"), computeContentHash("world"));
  });

  it("rejects duplicate active content in namespace", async () => {
    const dbPath = "/tmp/amh-dedup-test.db";
    if (existsSync(dbPath)) unlinkSync(dbPath);
    const store = new SqliteStore(dbPath);

    const record = {
      amh_version: "0.1" as const,
      memory_id: "a",
      version: 1,
      status: "active" as const,
      agent_id: "agent",
      namespace: "ns1",
      memory_type: "fact" as const,
      content: { format: "text/plain", value: "same content" },
      source: { type: "agent" as const, ref: "", tier: "llm_derived" as const },
      created_at: new Date().toISOString(),
      created_by: "agent",
      content_hash: computeContentHash("same content"),
    };

    await store.put(record);

    await assert.rejects(
      () =>
        checkDedup(
          { ...record, memory_id: "b" },
          store
        ),
      DuplicateMemoryError
    );

    unlinkSync(dbPath);
  });
});