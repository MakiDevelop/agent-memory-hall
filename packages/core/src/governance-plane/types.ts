export type RuleCategory = "immutable" | "structural" | "operational";

export interface GovernanceRule {
  rule_id: string;
  version: number;
  status: "active" | "suspended" | "archived";
  category: RuleCategory;
  title: string;
  specification: string;
  enforced_at_layers: number[];
  created_by_decision?: string | null;
}

export interface GovernanceAmendment {
  amendment_id: string;
  target_rule_id: string;
  proposed_specification: string;
  rationale: string;
  decision_id: string;
}
