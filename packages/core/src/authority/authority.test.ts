import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { SqliteAuthorityStore } from "./sqlite-authority-store.js";
import { defineRole, assignRole, revokeRoleAssignment, checkAuthority } from "./operations.js";

describe("L4 Authority", () => {
  let db: InstanceType<typeof Database>;
  let store: SqliteAuthorityStore;

  before(() => {
    db = new Database(":memory:");
    store = new SqliteAuthorityStore(db);
  });

  after(() => db.close());

  it("defineRole + getRole round-trip", async () => {
    const result = await defineRole(
      { role_id: "architect", display_name: "Architect", scope: "all", capabilities: ["write_memory", "propose_decision"], constraints: ["cannot_deploy"], risk_threshold: null, escalation_target: "chair" },
      store,
    );
    assert.equal(result.role_id, "architect");
    assert.equal(result.status, "active");

    const role = await store.getRole("architect");
    assert.ok(role);
    assert.deepEqual(role.capabilities, ["write_memory", "propose_decision"]);
    assert.deepEqual(role.constraints, ["cannot_deploy"]);
    assert.equal(role.escalation_target, "chair");
  });

  it("assignRole + checkAuthority", async () => {
    const assignment = await assignRole("agent:planner", "architect", "human:maki", store);
    assert.equal(assignment.principal_id, "agent:planner");
    assert.equal(assignment.role_id, "architect");

    const result = await checkAuthority("agent:planner", "write_memory", store);
    assert.equal(result.allowed, true);
    assert.ok(result.roles.includes("architect"));
  });

  it("constraint overrides capability", async () => {
    const result = await checkAuthority("agent:planner", "cannot_deploy", store);
    assert.equal(result.allowed, false);
  });

  it("action not in capabilities → denied", async () => {
    const result = await checkAuthority("agent:planner", "veto_decision", store);
    assert.equal(result.allowed, false);
  });

  it("no assignments → denied", async () => {
    const result = await checkAuthority("agent:unknown", "write_memory", store);
    assert.equal(result.allowed, false);
    assert.deepEqual(result.roles, []);
  });

  it("revokeRoleAssignment removes access", async () => {
    await defineRole(
      { role_id: "temp", display_name: "Temp", scope: "test", capabilities: ["read_memory"], constraints: [], risk_threshold: null, escalation_target: null },
      store,
    );
    const a = await assignRole("agent:temp", "temp", "human:maki", store);
    let check = await checkAuthority("agent:temp", "read_memory", store);
    assert.equal(check.allowed, true);

    await revokeRoleAssignment(a.assignment_id, "human:maki", store);
    check = await checkAuthority("agent:temp", "read_memory", store);
    assert.equal(check.allowed, false);
  });

  it("multi-role union: capabilities merge, constraints override", async () => {
    await defineRole(
      { role_id: "reader", display_name: "Reader", scope: "all", capabilities: ["read_memory"], constraints: [], risk_threshold: null, escalation_target: null },
      store,
    );
    await defineRole(
      { role_id: "restrictor", display_name: "Restrictor", scope: "all", capabilities: ["transfer_memory"], constraints: ["read_memory"], risk_threshold: null, escalation_target: null },
      store,
    );
    await assignRole("agent:multi", "reader", "human:maki", store);
    await assignRole("agent:multi", "restrictor", "human:maki", store);

    const result = await checkAuthority("agent:multi", "read_memory", store);
    assert.equal(result.allowed, false, "constraint from restrictor should block read_memory from reader");
  });
});
