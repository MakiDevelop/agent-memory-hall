import { randomUUID } from "node:crypto";
import type { AuthorityStore, Escalation } from "./store.js";
import type {
  CheckAuthorityResult,
  IndependentReviewRecord,
  Role,
  RoleAssignment,
} from "./types.js";

export class AuthorityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorityError";
  }
}

export async function defineRole(
  role: Omit<Role, "status">,
  store: AuthorityStore,
): Promise<{ role_id: string; status: "active" }> {
  if (!role.role_id.trim()) {
    throw new AuthorityError("role_id is required");
  }
  if (await store.getRole(role.role_id)) {
    throw new AuthorityError(`Role already exists: ${role.role_id}`);
  }

  await store.putRole({ ...role, status: "active" });
  return { role_id: role.role_id, status: "active" };
}

export async function assignRole(
  principalId: string,
  roleId: string,
  assignedBy: string,
  store: AuthorityStore,
  opts?: { scopeNamespace?: string; delegationAllowed?: boolean },
): Promise<RoleAssignment> {
  if (!principalId.trim()) {
    throw new AuthorityError("principal_id is required");
  }
  if (!assignedBy.trim()) {
    throw new AuthorityError("assigned_by is required");
  }
  const role = await store.getRole(roleId);
  if (!role || role.status !== "active") {
    throw new AuthorityError(`Active role not found: ${roleId}`);
  }

  const assignment: RoleAssignment = {
    assignment_id: randomUUID(),
    principal_id: principalId,
    role_id: roleId,
    assigned_by: assignedBy,
    assigned_at: new Date().toISOString(),
    expires_at: null,
    scope_namespace: opts?.scopeNamespace ?? null,
    delegation_allowed: opts?.delegationAllowed ?? false,
    status: "active",
  };
  await store.putRoleAssignment(assignment);
  return assignment;
}

export async function revokeRoleAssignment(
  assignmentId: string,
  revokedBy: string,
  store: AuthorityStore,
): Promise<{ assignment_id: string; status: "revoked" }> {
  if (!revokedBy.trim()) {
    throw new AuthorityError("revoked_by is required");
  }
  const assignment = await store.getRoleAssignment(assignmentId);
  if (!assignment) {
    throw new AuthorityError(`Role assignment not found: ${assignmentId}`);
  }

  await store.revokeRoleAssignment(assignmentId);
  return { assignment_id: assignmentId, status: "revoked" };
}

export async function checkAuthority(
  principalId: string,
  action: string,
  store: AuthorityStore,
  namespace?: string,
): Promise<CheckAuthorityResult> {
  const assignments = await store.getActiveAssignmentsForPrincipal(principalId, namespace);
  const capabilities = new Set<string>();
  const constraints = new Set<string>();
  const roles: string[] = [];

  for (const assignment of assignments) {
    const role = await store.getRole(assignment.role_id);
    if (!role || role.status !== "active") continue;

    roles.push(role.role_id);
    for (const capability of role.capabilities) capabilities.add(capability);
    for (const constraint of role.constraints) constraints.add(constraint);
  }

  const blocked = constraints.has(action);
  return {
    allowed: capabilities.has(action) && !blocked,
    roles,
    constraints_applied: blocked ? [action] : [],
  };
}

export async function escalate(
  decisionId: string,
  reason: string,
  escalatedBy: string,
  store: AuthorityStore,
  appendAudit: (event: { memory_id: string; operation: string; principal_id: string; details: string }) => Promise<void>,
): Promise<{
  escalation_id: string;
  target_role: string;
  status: "pending";
}> {
  const assignments = await store.getActiveAssignmentsForPrincipal(escalatedBy);
  let targetRole: string | null = null;

  for (const assignment of assignments) {
    const role = await store.getRole(assignment.role_id);
    if (role?.status === "active" && role.escalation_target) {
      targetRole = role.escalation_target;
      break;
    }
  }

  if (!targetRole) {
    throw new AuthorityError(`No escalation target found for principal: ${escalatedBy}`);
  }

  const escalation: Escalation = {
    escalation_id: randomUUID(),
    decision_id: decisionId,
    escalated_by: escalatedBy,
    escalated_at: new Date().toISOString(),
    reason,
    target_role: targetRole,
    status: "pending",
  };
  await store.putEscalation(escalation);
  await appendAudit({
    memory_id: decisionId,
    operation: "authority.escalate",
    principal_id: escalatedBy,
    details: JSON.stringify({
      escalation_id: escalation.escalation_id,
      reason,
      target_role: targetRole,
      status: escalation.status,
    }),
  });

  return {
    escalation_id: escalation.escalation_id,
    target_role: targetRole,
    status: "pending",
  };
}

export async function submitIndependentReview(
  decisionId: string,
  reviewerPrincipalId: string,
  reviewerRoleId: string,
  position: "approve" | "oppose" | "conditional_approve",
  reasoning: string,
  riskCategories: string[],
  evidenceIds: string[],
  store: AuthorityStore,
): Promise<IndependentReviewRecord> {
  const role = await store.getRole(reviewerRoleId);
  if (!role || role.status !== "active") {
    throw new AuthorityError(`Active reviewer role not found: ${reviewerRoleId}`);
  }

  const review: IndependentReviewRecord = {
    review_id: randomUUID(),
    decision_id: decisionId,
    reviewer_principal_id: reviewerPrincipalId,
    reviewer_role_id: reviewerRoleId,
    position,
    reasoning,
    risk_categories_addressed: riskCategories,
    evidence_ids: evidenceIds,
  };
  await store.putIndependentReview(review);
  return review;
}
