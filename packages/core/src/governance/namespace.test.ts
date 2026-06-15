import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { enforceNamespaceIsolation, NamespaceViolationError } from "./namespace.js";

describe("namespace isolation", () => {
  it("scopes query to caller namespace when unset", () => {
    const scoped = enforceNamespaceIsolation("project:acme", {});
    assert.equal(scoped.namespace, "project:acme");
  });

  it("allows same namespace", () => {
    const scoped = enforceNamespaceIsolation("project:acme", { namespace: "project:acme" });
    assert.equal(scoped.namespace, "project:acme");
  });

  it("rejects cross-namespace access", () => {
    assert.throws(
      () => enforceNamespaceIsolation("project:acme", { namespace: "project:other" }),
      NamespaceViolationError
    );
  });
});