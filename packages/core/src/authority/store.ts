import type { Role, RoleAssignment, IndependentReviewRecord } from "./types.js";

export interface Escalation {
  escalation_id: string;
  decision_id: string;
  escalated_by: string;
  escalated_at: string;
  reason: string;
  target_role: string;
  status: "pending";
}

export interface AuthorityStore {
  migrate(): void;

  putRole(role: Role): Promise<void>;
  getRole(roleId: string): Promise<Role | null>;

  putRoleAssignment(assignment: RoleAssignment): Promise<void>;
  getRoleAssignment(assignmentId: string): Promise<RoleAssignment | null>;
  getActiveAssignmentsForPrincipal(principalId: string, namespace?: string): Promise<RoleAssignment[]>;
  revokeRoleAssignment(assignmentId: string): Promise<void>;

  putEscalation(escalation: Escalation): Promise<void>;

  putIndependentReview(review: IndependentReviewRecord): Promise<void>;
  getReviewsForDecision(decisionId: string): Promise<IndependentReviewRecord[]>;

  recordDecisionProposer(decisionId: string, proposerId: string): Promise<void>;
  getProposerForDecision(decisionId: string): Promise<string | null>;

  cleanup(): Promise<void>;
}
