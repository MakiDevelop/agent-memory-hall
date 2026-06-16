export type RuleId =
  | "authority-violation"
  | "trust-escalation"
  | "ouroboros-cycle"
  | "decision-without-review"
  | "self-approve"
  | "revoke-without-audit"
  | "namespace-cross-write"
  | "tier-downgrade";

export interface Rule {
  id: RuleId;
  name: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
}

export const rules: Rule[] = [
  {
    id: "authority-violation",
    name: "Authority Violation",
    description: "An agent performed an action without the required capability in their assigned role",
    severity: "critical",
  },
  {
    id: "trust-escalation",
    name: "Trust Escalation",
    description: "A memory's source tier was upgraded without proper trust proof or human confirmation",
    severity: "critical",
  },
  {
    id: "ouroboros-cycle",
    name: "Ouroboros Cycle",
    description: "An LLM-derived memory was fed back into a derivation chain, creating a circular trust dependency",
    severity: "high",
  },
  {
    id: "decision-without-review",
    name: "Decision Without Review",
    description: "A high-risk decision was ratified without any independent review",
    severity: "high",
  },
  {
    id: "self-approve",
    name: "Self-Approval",
    description: "The same principal both proposed and ratified a decision",
    severity: "critical",
  },
  {
    id: "revoke-without-audit",
    name: "Revoke Without Audit",
    description: "A memory was revoked but no corresponding audit event was recorded",
    severity: "medium",
  },
  {
    id: "namespace-cross-write",
    name: "Namespace Cross-Write",
    description: "An agent wrote to a namespace outside their assigned scope",
    severity: "high",
  },
  {
    id: "tier-downgrade",
    name: "Tier Downgrade",
    description: "A memory's trust tier was lowered from human_confirmed to a lesser tier",
    severity: "medium",
  },
];
