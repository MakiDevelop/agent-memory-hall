import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { requireTrustedCaller, CallerNamespaceRequiredError } from "./caller.js";
import { queryMemories } from "../operations/read.js";
import { SqliteStore } from "../store/sqlite.js";
import { unlinkSync, existsSync } from "node:fs";

describe("requireTrustedCaller", () => {
  it("throws when isolation enabled without caller", () => {
    assert.throws(
      () => requireTrustedCaller(true, undefined),
      CallerNamespaceRequiredError
    );
  });

  it("allows when isolation disabled", () => {
    assert.doesNotThrow(() => requireTrustedCaller(false, undefined));
  });

  it("queryMemories fails closed without trusted caller", async () => {
    const dbPath = "/tmp/amh-caller-test.db";
    if (existsSync(dbPath)) unlinkSync(dbPath);
    const store = new SqliteStore(dbPath);

    await assert.rejects(
      () => queryMemories({}, store, { namespaceIsolation: true }),
      CallerNamespaceRequiredError
    );

    unlinkSync(dbPath);
  });
});