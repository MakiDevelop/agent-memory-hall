import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JsonFileStore } from "./json-file.js";

const jsonFileSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "store", "json-file.ts"),
  "utf-8"
);

describe("JsonFileStore concurrency", () => {
  it("uses readLocked for read-only store methods", () => {
    for (const method of ["get", "findByContentHash", "query", "list", "getAudit", "count", "namespaces"]) {
      const pattern = new RegExp(`async ${method}[\\s\\S]*?return this\\.readLocked`);
      assert.match(jsonFileSrc, pattern, `${method} should use readLocked`);
    }
  });

  it("maps legacy decision records to fact and matches fact queries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "amh-json-store-"));
    const path = join(dir, "memory.json");
    await writeFile(
      path,
      JSON.stringify({
        records: [
          {
            amh_version: "0.1",
            memory_id: "legacy-decision",
            version: 1,
            status: "active",
            agent_id: "codex",
            namespace: "project:test",
            memory_type: "decision",
            content: { format: "text/plain", value: "legacy decision" },
            source: { type: "agent", ref: "", tier: "llm_derived" },
            created_at: "2026-06-15T00:00:00Z",
            created_by: "codex",
          },
        ],
        audit: [],
      }),
      "utf-8"
    );

    const store = new JsonFileStore(path);
    const record = await store.get("legacy-decision");
    assert.equal(record?.memory_type, "fact");

    const results = await store.query({ namespace: "project:test", memory_type: "fact" });
    assert.equal(results.length, 1);
    assert.equal(results[0]?.memory_type, "fact");
  });
});
