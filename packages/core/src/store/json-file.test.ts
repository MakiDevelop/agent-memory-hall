import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
});