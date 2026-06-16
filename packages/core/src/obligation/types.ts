import type { RiskLevel } from "../decision/types.js";

export type ObligationStatus = "pending" | "in_progress" | "blocked" | "stale" | "closed" | "abandoned";

export type ActionType = string;

export interface ObligationEvidence {
  ref: string;
  result: string;
}

export type StaleCondition =
  | { type: "ttl"; seconds: number }
  | { type: "external_condition"; ref: string };

export interface ObligationPacket {
  obligation_id: string;
  promise: string;
  owner: string;
  fallback_owner: string;
  status: ObligationStatus;
  evidence: ObligationEvidence[];
  missing_evidence: string[];
  blocked_by: string[];
  stale_if: StaleCondition;
  allowed_next_actions: ActionType[];
  created_at: string;
  last_touched_at: string;
}

export interface PolicyEvaluation {
  risk_tier: RiskLevel;
  operation_permissions: string[];
  evaluator_id: string;
  evaluated_at: string;
  policy_version: string;
  evaluator_scope: string;
  evidence_refs: string[];
  bound_obligation_id: string;
}

export interface AuditEntry {
  type:
    | "attempted_authority_reuse"
    | "stale_evaluation_reuse"
    | "self_evaluator_refusal"
    | "missing_evidence_closure"
    | "llm_derived_closure"
    | "break_glass_activation"
    | string;
  details: string;
  timestamp: string;
}
