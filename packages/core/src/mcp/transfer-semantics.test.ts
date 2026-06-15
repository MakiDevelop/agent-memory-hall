import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "mcp", "server.ts"),
  "utf-8"
);

describe("transfer semantics documentation", () => {
  it("describes same-namespace reassignment in MCP tool", () => {
    assert.match(serverSrc, /within the caller namespace/i);
    assert.doesNotMatch(serverSrc, /Cross-namespace transfer/i);
  });
});