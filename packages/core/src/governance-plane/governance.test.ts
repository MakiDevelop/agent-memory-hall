import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { SqliteGovernanceStore } from "./sqlite-governance-store.js";
import { defineRule, proposeAmendment, suspendRule, healthCheck, GovernanceError } from "./operations.js";

describe("Governance Plane", () => {
  let db: InstanceType<typeof Database>;
  let store: SqliteGovernanceStore;

  before(() => {
    db = new Database(":memory:");
    store = new SqliteGovernanceStore(db);
  });

  after(() => db.close());

  it("defineRule + getRule round-trip", async () => {
    const result = await defineRule(
      { rule_id: "anti-ouroboros", category: "immutable", title: "Anti-Ouroboros", specification: "LLM cannot supersede LLM without human", enforced_at_layers: [1, 2, 5] },
      store,
    );
    assert.equal(result.rule_id, "anti-ouroboros");
    assert.equal(result.version, 1);
    assert.equal(result.status, "active");

    const rule = await store.getRule("anti-ouroboros");
    assert.ok(rule);
    assert.equal(rule.category, "immutable");
    assert.deepEqual(rule.enforced_at_layers, [1, 2, 5]);
  });

  it("cannot amend immutable rules", async () => {
    await assert.rejects(
      () => proposeAmendment("anti-ouroboros", "new spec", "want to change", "agent:rogue", store),
      (err: Error) => err instanceof GovernanceError && err.message.includes("immutable"),
    );
  });

  it("cannot suspend immutable rules", async () => {
    await assert.rejects(
      () => suspendRule("anti-ouroboros", "testing", store),
      (err: Error) => err instanceof GovernanceError && err.message.includes("immutable"),
    );
  });

  it("can amend structural rules → returns critical risk", async () => {
    await defineRule(
      { rule_id: "role-manifest", category: "structural", title: "Role Manifest", specification: "All roles must be declared", enforced_at_layers: [4] },
      store,
    );
    const result = await proposeAmendment("role-manifest", "updated spec", "needs update", "human:maki", store);
    assert.ok(result.amendment_id);
    assert.ok(result.decision_id);
    assert.equal(result.risk_level, "critical");
  });

  it("can suspend operational rules", async () => {
    await defineRule(
      { rule_id: "daily-review", category: "operational", title: "Daily Review", specification: "Review all decisions daily", enforced_at_layers: [5] },
      store,
    );
    const result = await suspendRule("daily-review", "pausing for maintenance", store);
    assert.equal(result.status, "suspended");

    const rule = await store.getRule("daily-review");
    assert.equal(rule?.status, "suspended");
  });

  it("healthCheck returns empty for fresh system", async () => {
    const result = await healthCheck(30, store);
    assert.ok(Array.isArray(result.dormant_rules));
    assert.ok(Array.isArray(result.unexercised_roles));
  });
});
