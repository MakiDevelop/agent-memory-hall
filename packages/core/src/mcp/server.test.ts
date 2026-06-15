import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "mcp", "server.ts"),
  "utf-8"
);

describe("MCP server trust boundary", () => {
  it("does not expose caller_namespace in tool schemas", () => {
    assert.doesNotMatch(serverSrc, /caller_namespace:\s*z\./);
  });

  it("binds write gate context only to server callerNamespace", () => {
    assert.match(serverSrc, /\{\s*callerNamespace\s*\}/);
    assert.doesNotMatch(serverSrc, /params\.caller_namespace/);
  });
});