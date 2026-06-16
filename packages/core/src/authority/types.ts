export type Capability =
  | "write_memory" | "read_memory" | "supersede_memory" | "revoke_memory"
  | "transfer_memory" | "tier_upgrade" | "propose_decision" | "ratify_decision"
  | "veto_decision" | "grant_authority" | "revoke_authority" | "escalate"
  | "execute_tool" | "break_glass" | "modify_governance"
  | string;

export type Constraint =
  | "cannot_deploy" | "cannot_delete_memory" | "cannot_override_decision"
  | "cannot_self_approve" | "cannot_modify_governance" | "requires_independent_review"
  | string;

export interface Role {
  role_id: string;
  display_name: string;
  scope: string;
  capabilities: Capability[];
  constraints: Constraint[];
  risk_threshold?: number | null;
  escalation_target?: string | null;
  status: "active" | "suspended" | "revoked";
}

export interface RoleAssignment {
  assignment_id: string;
  principal_id: string;
  role_id: string;
  assigned_by: string;
  assigned_at: string;
  expires_at?: string | null;
  scope_namespace?: string | null;
  delegation_allowed: boolean;
  status: "active" | "revoked";
}

export interface CheckAuthorityResult {
  allowed: boolean;
  roles: string[];
  constraints_applied: string[];
}

export interface EscalationResult {
  escalation_id: string;
  target_role: string;
  status: "pending";
}

export interface IndependentReviewRecord {
  review_id: string;
  decision_id: string;
  reviewer_principal_id: string;
  reviewer_role_id: string;
  position: "approve" | "oppose" | "conditional_approve";
  reasoning: string;
  risk_categories_addressed: string[];
  evidence_ids: string[];
}
