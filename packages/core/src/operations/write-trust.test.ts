import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const writeSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "operations", "write.ts"),
  "utf-8"
);

describe("write trust boundary", () => {
  it("does not accept caller_namespace on WriteInput", () => {
    assert.doesNotMatch(writeSrc, /caller_namespace\?:/);
    assert.doesNotMatch(writeSrc, /input\.caller_namespace/);
  });

  it("binds write gate context only to gateContext", () => {
    assert.match(writeSrc, /callerNamespace:\s*gateContext\?\.callerNamespace/);
  });
});