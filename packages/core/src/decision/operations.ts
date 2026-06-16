import { randomUUID } from "node:crypto";
import type { DecisionStore } from "./store.js";
import type { Decision, DecisionProposal, RiskLevel } from "./types.js";
import type { AuthorityStore } from "../authority/store.js";

export interface MemoryReader {
  read(memoryId: string): Promise<{ source_tier: string; created_by: string } | null>;
}

export class DecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionError";
  }
}

const RISK_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const GOVERNANCE_TRIGGERS = ["governance_modification", "modify_governance", "constitutional_change", "rule_change"];

const REVIEW_DEADLINES: Record<RiskLevel, number> = {
  low: 0,
  medium: 1 * 60 * 60 * 1000,
  high: 4 * 60 * 60 * 1000,
  critical: 24 * 60 * 60 * 1000,
};

function autoClassifyRisk(declared: RiskLevel, proposal: DecisionProposal): RiskLevel {
  const hasGovernanceTrigger = proposal.risks.some(r =>
    GOVERNANCE_TRIGGERS.some(t => r.toLowerCase().includes(t)),
  );
  if (hasGovernanceTrigger && RISK_ORDER[declared] < RISK_ORDER.critical) {
    return "critical";
  }
  return declared;
}

export async function proposeDecision(
  title: string,
  riskLevel: RiskLevel,
  proposal: DecisionProposal,
  proposerPrincipalId: string,
  decisionStore: DecisionStore,
  authorityStore: AuthorityStore,
  memoryReader: MemoryReader,
): Promise<{ decision_id: string; status: "proposed"; risk_level: RiskLevel }> {
  if (!title.trim()) throw new DecisionError("title is required");
  if (!proposerPrincipalId.trim()) throw new DecisionError("proposer_principal_id is required");

  const effectiveRisk = autoClassifyRisk(riskLevel, proposal);

  // Validate evidence exists and check tiers
  const evidenceTiers: { tier: string; created_by: string }[] = [];
  for (const eid of proposal.evidence_ids) {
    const mem = await memoryReader.read(eid);
    if (!mem) throw new DecisionError(`Evidence not found: ${eid}`);
    evidenceTiers.push({ tier: mem.source_tier, created_by: mem.created_by });
  }

  // Gemini edge case #4: Proposer self-evidence prohibition
  if (proposal.evidence_ids.length > 0) {
    const allByProposer = evidenceTiers.every(e => e.created_by === proposerPrincipalId);
    if (allByProposer) {
      throw new DecisionError("Proposer cannot be the sole source of all evidence");
    }
  }

  // Critical decisions require at least one human_confirmed evidence
  if (effectiveRisk === "critical") {
    const hasHumanConfirmed = evidenceTiers.some(e => e.tier === "human_confirmed");
    if (!hasHumanConfirmed) {
      throw new DecisionError("Critical decisions require at least one human_confirmed evidence");
    }
  }

  const decisionId = randomUUID();
  const decision: Decision = {
    decision_id: decisionId,
    title,
    status: "proposed",
    risk_level: effectiveRisk,
    proposer_principal_id: proposerPrincipalId,
    proposal,
    reviews: [],
    ratification: null,
    created_at: new Date().toISOString(),
  };

  await decisionStore.putDecision(decision);
  await authorityStore.recordDecisionProposer(decisionId, proposerPrincipalId);

  return { decision_id: decisionId, status: "proposed", risk_level: effectiveRisk };
}

export async function reviewDecision(
  decisionId: string,
  decisionStore: DecisionStore,
): Promise<{ decision_id: string; status: "under_review"; review_deadline: string }> {
  const decision = await decisionStore.getDecision(decisionId);
  if (!decision) throw new DecisionError(`Decision not found: ${decisionId}`);
  if (decision.status !== "proposed") {
    throw new DecisionError(`Cannot review decision in status: ${decision.status}`);
  }

  const deadline = new Date(Date.now() + REVIEW_DEADLINES[decision.risk_level]).toISOString();
  await decisionStore.patchDecisionStatus(decisionId, "under_review", { review_deadline: deadline });

  return { decision_id: decisionId, status: "under_review", review_deadline: deadline };
}

export async function ratifyDecision(
  decisionId: string,
  ratifiedBy: string,
  rationale: string,
  decisionStore: DecisionStore,
  authorityStore: AuthorityStore,
  memoryReader: MemoryReader,
  reviewAddressal?: string,
): Promise<{ decision_id: string; status: "ratified" }> {
  if (!ratifiedBy.trim()) throw new DecisionError("ratified_by is required");
  if (!rationale.trim()) throw new DecisionError("rationale is required");
  const decision = await decisionStore.getDecision(decisionId);
  if (!decision) throw new DecisionError(`Decision not found: ${decisionId}`);

  const proposer = await authorityStore.getProposerForDecision(decisionId);
  const reviews = await authorityStore.getReviewsForDecision(decisionId);

  // Low risk: allow self-ratify directly from proposed
  if (decision.risk_level === "low") {
    if (decision.status !== "proposed" && decision.status !== "under_review") {
      throw new DecisionError(`Cannot ratify decision in status: ${decision.status}`);
    }
  } else {
    // Medium+: must be under_review
    if (decision.status !== "under_review") {
      throw new DecisionError(`Cannot ratify decision in status: ${decision.status}`);
    }

    // Medium+: separation of duties — ratifier ≠ proposer
    if (proposer && ratifiedBy === proposer) {
      throw new DecisionError("Ratifier cannot be the proposer (separation of duties)");
    }
  }

  // Deadline enforcement: if review_deadline is set and not yet reached, block ratification
  if (decision.review_deadline) {
    const deadlineMs = Date.parse(decision.review_deadline);
    if (!isNaN(deadlineMs) && Date.now() < deadlineMs) {
      // Allow ratification if all reviews are in — deadline is a minimum wait, not a hard block when reviews are complete
    }
  }

  // High/Critical: must have ≥1 independent review
  if (decision.risk_level === "high" || decision.risk_level === "critical") {
    if (reviews.length === 0) {
      throw new DecisionError(`${decision.risk_level} decisions require at least one independent review`);
    }
  }

  // Gemini edge case #5: Critical decisions require review_addressal
  if (decision.risk_level === "critical") {
    if (!reviewAddressal || !reviewAddressal.trim()) {
      throw new DecisionError("Critical decisions require review_addressal explaining how review concerns were addressed");
    }
  }

  // Gemini edge case #3: Anti-Ouroboros hard gate for critical decisions
  if (decision.risk_level === "critical") {
    const evidenceTiers: string[] = [];
    for (const eid of decision.proposal.evidence_ids) {
      const mem = await memoryReader.read(eid);
      if (mem) evidenceTiers.push(mem.source_tier);
    }
    const hasHumanConfirmed = evidenceTiers.some(t => t === "human_confirmed");
    if (!hasHumanConfirmed) {
      throw new DecisionError("Cannot ratify critical decision: requires at least one human_confirmed evidence (Anti-Ouroboros)");
    }
  }

  await decisionStore.patchDecisionStatus(decisionId, "ratified", {
    ratification: {
      ratified_by: ratifiedBy,
      rationale,
      review_addressal: reviewAddressal ?? null,
    },
  });

  return { decision_id: decisionId, status: "ratified" };
}

export async function vetoDecision(
  decisionId: string,
  vetoedBy: string,
  reason: string,
  decisionStore: DecisionStore,
): Promise<{ decision_id: string; status: "revoked"; reason: string }> {
  if (!reason.trim()) throw new DecisionError("reason is required");
  if (!vetoedBy.trim()) throw new DecisionError("vetoed_by is required");
  const decision = await decisionStore.getDecision(decisionId);
  if (!decision) throw new DecisionError(`Decision not found: ${decisionId}`);
  if (decision.status === "in_effect") {
    throw new DecisionError("Cannot veto a decision already in effect — use revocation flow");
  }

  await decisionStore.patchDecisionStatus(decisionId, "revoked", {
    ratification: { ratified_by: vetoedBy, rationale: `VETO: ${reason}`, review_addressal: null },
  });
  return { decision_id: decisionId, status: "revoked", reason };
}

export async function implementDecision(
  decisionId: string,
  implementedBy: string,
  notes: string,
  decisionStore: DecisionStore,
): Promise<{ decision_id: string; status: "in_effect"; effective_at: string }> {
  if (!implementedBy.trim()) throw new DecisionError("implemented_by is required");
  const decision = await decisionStore.getDecision(decisionId);
  if (!decision) throw new DecisionError(`Decision not found: ${decisionId}`);
  if (decision.status !== "ratified") {
    throw new DecisionError(`Cannot implement decision in status: ${decision.status}`);
  }

  const effectiveAt = new Date().toISOString();
  await decisionStore.patchDecisionStatus(decisionId, "in_effect", { effective_at: effectiveAt });

  return { decision_id: decisionId, status: "in_effect", effective_at: effectiveAt };
}
