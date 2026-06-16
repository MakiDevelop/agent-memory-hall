import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { SqliteObligationStore } from "./sqlite-obligation-store.js";
import {
  activateBreakGlass,
  closeObligation,
  ForbiddenClosureError,
  performObligationAction,
  putObligation,
} from "./operations.js";
import type { ObligationPacket, PolicyEvaluation } from "./types.js";

describe("L5 Obligation", () => {
  let db: InstanceType<typeof Database>;
  let store: SqliteObligationStore;

  beforeEach(() => {
    db = new Database(":memory:");
    store = new SqliteObligationStore(db);
  });

  afterEach(() => db.close());

  it("blocks llm_derived closure and allows human_confirmed closure", async () => {
    await seed();

    await assert.rejects(
      closeObligation("obl-1", { actor_id: "agent:codex", source_tier: "llm_derived" }, store),
      ForbiddenClosureError,
    );

    const result = await closeObligation(
      "obl-1",
      { actor_id: "human:maki", source_tier: "human_confirmed" },
      store,
    );
    assert.equal(result.status, "closed");
  });

  it("blocks closure with missing evidence and allows closure after evidence is complete", async () => {
    await seed({ missing_evidence: ["owner confirmation"] });

    await assert.rejects(
      closeObligation("obl-1", { actor_id: "human:maki", source_tier: "human_confirmed" }, store),
      /missing evidence/,
    );

    await seed({ missing_evidence: [] });
    const result = await closeObligation(
      "obl-1",
      { actor_id: "human:maki", source_tier: "human_confirmed" },
      store,
    );
    assert.equal(result.status, "closed");
  });

  it("narrows stale permissions to refresh/query/escalate and allows recovery action", async () => {
    await seed({
      last_touched_at: "2026-06-16T00:00:00.000Z",
      stale_if: { type: "ttl", seconds: 60 },
      allowed_next_actions: ["read", "summarize", "refresh_evidence"],
    }, {
      operation_permissions: ["read", "summarize", "refresh_evidence", "query_owner", "escalate"],
    });

    await assert.rejects(
      performObligationAction(
        "obl-1",
        "read",
        { actor_id: "agent:runner", source_tier: "human_confirmed" },
        store,
        { now: new Date("2026-06-16T00:02:00.000Z") },
      ),
      /Action not allowed/,
    );

    const packet = await store.getObligation("obl-1");
    assert.deepEqual(packet?.allowed_next_actions, ["refresh_evidence", "query_owner", "escalate"]);
    assert.equal(packet?.status, "stale");

    const result = await performObligationAction(
      "obl-1",
      "refresh_evidence",
      { actor_id: "agent:runner", source_tier: "human_confirmed" },
      store,
      { now: new Date("2026-06-16T00:02:00.000Z") },
    );
    assert.equal(result.allowed, true);
  });

  it("blocks self, missing, and expired evaluator; allows independent fresh evaluator", async () => {
    await seed({}, { evaluator_id: "agent:runner" });

    await assert.rejects(
      performObligationAction(
        "obl-1",
        "read",
        { actor_id: "agent:runner", source_tier: "human_confirmed" },
        store,
      ),
      /Self-evaluator/,
    );

    await store.cleanup();
    await putObligation(packet(), evaluation({ evaluated_at: "2026-06-16T00:00:00.000Z" }), store);
    await assert.rejects(
      performObligationAction(
        "obl-1",
        "read",
        { actor_id: "agent:runner", source_tier: "human_confirmed" },
        store,
        { now: new Date("2026-06-16T00:02:00.000Z"), evaluationTtlSeconds: 60 },
      ),
      /expired/,
    );

    const freshTs = new Date().toISOString();
    await seed(
      { last_touched_at: freshTs, created_at: freshTs },
      { evaluator_id: "agent:reviewer", evaluated_at: freshTs },
    );
    const result = await performObligationAction(
      "obl-1",
      "read",
      { actor_id: "agent:runner", source_tier: "human_confirmed" },
      store,
    );
    assert.equal(result.allowed, true);
  });

  it("rejects borrowed-authority replay and accepts matching obligation binding", async () => {
    await seed({}, { bound_obligation_id: "obl-other" });

    await assert.rejects(
      performObligationAction(
        "obl-1",
        "read",
        { actor_id: "agent:runner", source_tier: "human_confirmed" },
        store,
      ),
      /different obligation/,
    );

    const freshTs = new Date().toISOString();
    await seed(
      { last_touched_at: freshTs, created_at: freshTs },
      { bound_obligation_id: "obl-1", evaluated_at: freshTs },
    );
    const result = await performObligationAction(
      "obl-1",
      "read",
      { actor_id: "agent:runner", source_tier: "human_confirmed" },
      store,
    );
    assert.equal(result.allowed, true);
  });

  it("requires non-acting-agent authority for break-glass", async () => {
    await seed();

    await assert.rejects(
      activateBreakGlass(
        "obl-1",
        { actor_id: "agent:runner", source_tier: "human_confirmed" },
        { authority_id: "auth-self", principal_id: "agent:runner" },
        store,
      ),
      /non-acting-agent/,
    );

    const result = await activateBreakGlass(
      "obl-1",
      { actor_id: "agent:runner", source_tier: "human_confirmed" },
      { authority_id: "auth-chair", principal_id: "human:maki" },
      store,
    );
    assert.equal(result.status, "in_progress");
    assert.equal(result.authority_id, "auth-chair");
  });

  async function seed(
    packetPatch: Partial<ObligationPacket> = {},
    evaluationPatch: Partial<PolicyEvaluation> = {},
  ): Promise<void> {
    await putObligation(packet(packetPatch), evaluation(evaluationPatch), store);
  }

  function packet(patch: Partial<ObligationPacket> = {}): ObligationPacket {
    return {
      obligation_id: "obl-1",
      promise: "Keep launch evidence fresh",
      owner: "agent:codex",
      fallback_owner: "human:maki",
      status: "pending",
      evidence: [{ ref: "mem-1", result: "verified" }],
      missing_evidence: [],
      blocked_by: [],
      stale_if: { type: "ttl", seconds: 3600 },
      allowed_next_actions: ["read", "summarize", "refresh_evidence"],
      created_at: "2026-06-16T00:00:00.000Z",
      last_touched_at: "2026-06-16T00:00:00.000Z",
      ...patch,
    };
  }

  function evaluation(patch: Partial<PolicyEvaluation> = {}): PolicyEvaluation {
    return {
      risk_tier: "medium",
      operation_permissions: ["read", "summarize", "refresh_evidence"],
      evaluator_id: "agent:reviewer",
      evaluated_at: "2026-06-16T00:00:00.000Z",
      policy_version: "l5.obligation.v1",
      evaluator_scope: "project:agent-memory-hall",
      evidence_refs: ["mem-1"],
      bound_obligation_id: "obl-1",
      ...patch,
    };
  }
});
