import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const resourcesSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "mcp", "resources.ts"),
  "utf-8"
);

describe("MCP resources trust boundary", () => {
  it("does not derive callerNamespace from URI namespace", () => {
    assert.doesNotMatch(resourcesSrc, /callerNamespace\s*\?\?\s*namespace/);
    assert.match(resourcesSrc, /requireTrustedCaller/);
  });

  it("returns empty contents when record not found", () => {
    assert.match(resourcesSrc, /contents:\s*\[\]/);
  });
});