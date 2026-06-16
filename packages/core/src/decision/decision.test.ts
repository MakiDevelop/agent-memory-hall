import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { SqliteAuthorityStore } from "../authority/sqlite-authority-store.js";
import { SqliteDecisionStore } from "./sqlite-decision-store.js";
import { defineRole } from "../authority/operations.js";
import { proposeDecision, reviewDecision, ratifyDecision, vetoDecision, implementDecision, DecisionError } from "./operations.js";
import type { MemoryReader } from "./operations.js";
import type { DecisionProposal } from "./types.js";

function makeMemoryReader(entries: Record<string, { source_tier: string; created_by: string }>): MemoryReader {
  return {
    async read(memoryId: string) {
      return entries[memoryId] ?? null;
    },
  };
}

const baseProposal: DecisionProposal = {
  assumptions: ["test assumption"],
  evidence_ids: ["ev1", "ev2"],
  risks: ["test risk"],
  trade_offs: ["test trade-off"],
  rollback_plan: "revert",
  implementation_steps: ["step 1"],
};

describe("L5 Decision", () => {
  let db: InstanceType<typeof Database>;
  let authorityStore: SqliteAuthorityStore;
  let decisionStore: SqliteDecisionStore;
  let reader: MemoryReader;

  before(async () => {
    db = new Database(":memory:");
    authorityStore = new SqliteAuthorityStore(db);
    decisionStore = new SqliteDecisionStore(db);
    reader = makeMemoryReader({
      ev1: { source_tier: "raw_source", created_by: "agent:analyst" },
      ev2: { source_tier: "human_confirmed", created_by: "human:maki" },
      ev_llm1: { source_tier: "llm_derived", created_by: "agent:claude" },
      ev_llm2: { source_tier: "llm_derived", created_by: "agent:codex" },
      ev_self: { source_tier: "raw_source", created_by: "agent:proposer" },
    });
    await defineRole(
      { role_id: "reviewer", display_name: "Reviewer", scope: "all", capabilities: ["read_memory"], constraints: [], risk_threshold: null, escalation_target: null },
      authorityStore,
    );
  });

  after(() => db.close());

  it("propose + review + ratify happy path (medium)", async () => {
    const p = await proposeDecision("Test decision", "medium", baseProposal, "agent:proposer", decisionStore, authorityStore, reader);
    assert.equal(p.status, "proposed");

    const r = await reviewDecision(p.decision_id, decisionStore);
    assert.equal(r.status, "under_review");
    assert.ok(r.review_deadline);

    const rat = await ratifyDecision(p.decision_id, "human:maki", "looks good", decisionStore, authorityStore, reader);
    assert.equal(rat.status, "ratified");
  });

  it("low risk allows self-ratify from proposed", async () => {
    const p = await proposeDecision("Low risk", "low", baseProposal, "agent:proposer", decisionStore, authorityStore, reader);
    const rat = await ratifyDecision(p.decision_id, "agent:proposer", "self-approve", decisionStore, authorityStore, reader);
    assert.equal(rat.status, "ratified");
  });

  it("medium+ rejects self-ratify (SoD)", async () => {
    const p = await proposeDecision("Medium SoD", "medium", baseProposal, "agent:proposer", decisionStore, authorityStore, reader);
    await reviewDecision(p.decision_id, decisionStore);
    await assert.rejects(
      () => ratifyDecision(p.decision_id, "agent:proposer", "self", decisionStore, authorityStore, reader),
      (err: Error) => err.message.includes("separation of duties"),
    );
  });

  it("proposer self-evidence prohibition", async () => {
    const selfReader = makeMemoryReader({
      ev_self1: { source_tier: "raw_source", created_by: "agent:sole" },
      ev_self2: { source_tier: "human_confirmed", created_by: "agent:sole" },
    });
    await assert.rejects(
      () => proposeDecision("Self evidence", "low", { ...baseProposal, evidence_ids: ["ev_self1", "ev_self2"] }, "agent:sole", decisionStore, authorityStore, selfReader),
      (err: Error) => err.message.includes("sole source"),
    );
  });

  it("critical requires human_confirmed evidence", async () => {
    const llmReader = makeMemoryReader({
      ev_llm1: { source_tier: "llm_derived", created_by: "agent:a" },
      ev_llm2: { source_tier: "raw_source", created_by: "agent:b" },
    });
    await assert.rejects(
      () => proposeDecision("Critical no human", "critical", { ...baseProposal, evidence_ids: ["ev_llm1", "ev_llm2"] }, "agent:proposer", decisionStore, authorityStore, llmReader),
      (err: Error) => err.message.includes("human_confirmed"),
    );
  });

  it("governance trigger auto-upgrades to critical", async () => {
    const humanReader = makeMemoryReader({
      ev_h: { source_tier: "human_confirmed", created_by: "human:maki" },
      ev_r: { source_tier: "raw_source", created_by: "agent:other" },
    });
    const p = await proposeDecision(
      "Governance change", "low",
      { ...baseProposal, evidence_ids: ["ev_h", "ev_r"], risks: ["governance_modification detected"] },
      "agent:proposer", decisionStore, authorityStore, humanReader,
    );
    assert.equal(p.risk_level, "critical");
  });

  it("veto works and blocks post-impl veto", async () => {
    const p = await proposeDecision("To veto", "low", baseProposal, "agent:proposer", decisionStore, authorityStore, reader);
    const v = await vetoDecision(p.decision_id, "human:maki", "rejected", decisionStore);
    assert.equal(v.status, "revoked");

    const p2 = await proposeDecision("To impl", "low", baseProposal, "agent:proposer", decisionStore, authorityStore, reader);
    await ratifyDecision(p2.decision_id, "agent:proposer", "ok", decisionStore, authorityStore, reader);
    await implementDecision(p2.decision_id, "agent:proposer", "deployed", decisionStore);
    await assert.rejects(
      () => vetoDecision(p2.decision_id, "human:maki", "too late", decisionStore),
      (err: Error) => err.message.includes("in effect"),
    );
  });

  it("critical ratify requires review addressal", async () => {
    const humanReader = makeMemoryReader({
      ev_h: { source_tier: "human_confirmed", created_by: "human:maki" },
      ev_r: { source_tier: "raw_source", created_by: "agent:other" },
    });
    const p = await proposeDecision(
      "Critical needs addressal", "critical",
      { ...baseProposal, evidence_ids: ["ev_h", "ev_r"] },
      "agent:proposer", decisionStore, authorityStore, humanReader,
    );
    await reviewDecision(p.decision_id, decisionStore);
    await authorityStore.putIndependentReview({
      review_id: "rev1", decision_id: p.decision_id,
      reviewer_principal_id: "human:reviewer", reviewer_role_id: "reviewer",
      position: "approve", reasoning: "solid evidence",
      risk_categories_addressed: ["governance"], evidence_ids: ["ev_h"],
    });
    await assert.rejects(
      () => ratifyDecision(p.decision_id, "human:maki", "approved", decisionStore, authorityStore, humanReader),
      (err: Error) => err.message.includes("review_addressal"),
    );
    const rat = await ratifyDecision(p.decision_id, "human:maki", "approved", decisionStore, authorityStore, humanReader, "concerns addressed by adding rollback plan");
    assert.equal(rat.status, "ratified");
  });
});
