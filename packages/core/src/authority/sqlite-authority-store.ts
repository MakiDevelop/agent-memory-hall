import type Database from "better-sqlite3";
import type { Escalation, AuthorityStore } from "./store.js";
import type { IndependentReviewRecord, Role, RoleAssignment } from "./types.js";

export class SqliteAuthorityStore implements AuthorityStore {
  constructor(private readonly db: Database.Database) {
    this.migrate();
  }

  migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        role_id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        scope TEXT NOT NULL,
        capabilities TEXT NOT NULL,
        constraints TEXT NOT NULL,
        risk_threshold REAL,
        escalation_target TEXT,
        status TEXT NOT NULL DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS role_assignments (
        assignment_id TEXT PRIMARY KEY,
        principal_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        assigned_by TEXT NOT NULL,
        assigned_at TEXT NOT NULL,
        expires_at TEXT,
        scope_namespace TEXT,
        delegation_allowed INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active'
      );

      CREATE INDEX IF NOT EXISTS idx_role_assignments_principal ON role_assignments(principal_id, status);

      CREATE TABLE IF NOT EXISTS escalations (
        escalation_id TEXT PRIMARY KEY,
        decision_id TEXT NOT NULL,
        escalated_by TEXT NOT NULL,
        escalated_at TEXT NOT NULL,
        reason TEXT NOT NULL,
        target_role TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
      );

      CREATE TABLE IF NOT EXISTS independent_reviews (
        review_id TEXT PRIMARY KEY,
        decision_id TEXT NOT NULL,
        reviewer_principal_id TEXT NOT NULL,
        reviewer_role_id TEXT NOT NULL,
        position TEXT NOT NULL,
        reasoning TEXT NOT NULL,
        risk_categories_addressed TEXT NOT NULL,
        evidence_ids TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_reviews_decision ON independent_reviews(decision_id);

      CREATE TABLE IF NOT EXISTS decision_proposers (
        decision_id TEXT PRIMARY KEY,
        proposer_principal_id TEXT NOT NULL
      );
    `);
  }

  async putRole(role: Role): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO roles
        (role_id, display_name, scope, capabilities, constraints, risk_threshold, escalation_target, status)
      VALUES
        (@role_id, @display_name, @scope, @capabilities, @constraints, @risk_threshold, @escalation_target, @status)
    `).run({
      role_id: role.role_id,
      display_name: role.display_name,
      scope: role.scope,
      capabilities: JSON.stringify(role.capabilities),
      constraints: JSON.stringify(role.constraints),
      risk_threshold: role.risk_threshold ?? null,
      escalation_target: role.escalation_target ?? null,
      status: role.status,
    });
  }

  async getRole(roleId: string): Promise<Role | null> {
    const row = this.db.prepare("SELECT * FROM roles WHERE role_id = ?").get(roleId) as RoleRow | undefined;
    return row ? this.toRole(row) : null;
  }

  async putRoleAssignment(assignment: RoleAssignment): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO role_assignments
        (assignment_id, principal_id, role_id, assigned_by, assigned_at, expires_at, scope_namespace, delegation_allowed, status)
      VALUES
        (@assignment_id, @principal_id, @role_id, @assigned_by, @assigned_at, @expires_at, @scope_namespace, @delegation_allowed, @status)
    `).run({
      assignment_id: assignment.assignment_id,
      principal_id: assignment.principal_id,
      role_id: assignment.role_id,
      assigned_by: assignment.assigned_by,
      assigned_at: assignment.assigned_at,
      expires_at: assignment.expires_at ?? null,
      scope_namespace: assignment.scope_namespace ?? null,
      delegation_allowed: assignment.delegation_allowed ? 1 : 0,
      status: assignment.status,
    });
  }

  async getRoleAssignment(assignmentId: string): Promise<RoleAssignment | null> {
    const row = this.db.prepare("SELECT * FROM role_assignments WHERE assignment_id = ?").get(assignmentId) as
      | RoleAssignmentRow
      | undefined;
    return row ? this.toRoleAssignment(row) : null;
  }

  async getActiveAssignmentsForPrincipal(principalId: string, namespace?: string): Promise<RoleAssignment[]> {
    const now = new Date().toISOString();
    const rows = namespace
      ? this.db.prepare(`
          SELECT * FROM role_assignments
          WHERE principal_id = ?
            AND status = 'active'
            AND (expires_at IS NULL OR expires_at > ?)
            AND (scope_namespace IS NULL OR scope_namespace = ?)
          ORDER BY assigned_at DESC
        `).all(principalId, now, namespace) as RoleAssignmentRow[]
      : this.db.prepare(`
          SELECT * FROM role_assignments
          WHERE principal_id = ?
            AND status = 'active'
            AND (expires_at IS NULL OR expires_at > ?)
          ORDER BY assigned_at DESC
        `).all(principalId, now) as RoleAssignmentRow[];
    return rows.map((row) => this.toRoleAssignment(row));
  }

  async revokeRoleAssignment(assignmentId: string): Promise<void> {
    this.db.prepare("UPDATE role_assignments SET status = 'revoked' WHERE assignment_id = ?").run(assignmentId);
  }

  async putEscalation(escalation: Escalation): Promise<void> {
    this.db.prepare(`
      INSERT INTO escalations
        (escalation_id, decision_id, escalated_by, escalated_at, reason, target_role, status)
      VALUES
        (@escalation_id, @decision_id, @escalated_by, @escalated_at, @reason, @target_role, @status)
    `).run(escalation);
  }

  async putIndependentReview(review: IndependentReviewRecord): Promise<void> {
    this.db.prepare(`
      INSERT INTO independent_reviews
        (review_id, decision_id, reviewer_principal_id, reviewer_role_id, position, reasoning, risk_categories_addressed, evidence_ids, created_at)
      VALUES
        (@review_id, @decision_id, @reviewer_principal_id, @reviewer_role_id, @position, @reasoning, @risk_categories_addressed, @evidence_ids, @created_at)
    `).run({
      ...review,
      risk_categories_addressed: JSON.stringify(review.risk_categories_addressed),
      evidence_ids: JSON.stringify(review.evidence_ids),
      created_at: new Date().toISOString(),
    });
  }

  async getReviewsForDecision(decisionId: string): Promise<IndependentReviewRecord[]> {
    const rows = this.db.prepare(`
      SELECT * FROM independent_reviews
      WHERE decision_id = ?
      ORDER BY created_at ASC
    `).all(decisionId) as IndependentReviewRow[];
    return rows.map((row) => this.toIndependentReview(row));
  }

  async recordDecisionProposer(decisionId: string, proposerId: string): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO decision_proposers (decision_id, proposer_principal_id)
      VALUES (?, ?)
    `).run(decisionId, proposerId);
  }

  async getProposerForDecision(decisionId: string): Promise<string | null> {
    const row = this.db.prepare("SELECT proposer_principal_id FROM decision_proposers WHERE decision_id = ?").get(decisionId) as
      | { proposer_principal_id: string }
      | undefined;
    return row?.proposer_principal_id ?? null;
  }

  async cleanup(): Promise<void> {
    return;
  }

  private toRole(row: RoleRow): Role {
    return {
      role_id: row.role_id,
      display_name: row.display_name,
      scope: row.scope,
      capabilities: JSON.parse(row.capabilities),
      constraints: JSON.parse(row.constraints),
      risk_threshold: row.risk_threshold ?? null,
      escalation_target: row.escalation_target ?? null,
      status: row.status,
    };
  }

  private toRoleAssignment(row: RoleAssignmentRow): RoleAssignment {
    return {
      assignment_id: row.assignment_id,
      principal_id: row.principal_id,
      role_id: row.role_id,
      assigned_by: row.assigned_by,
      assigned_at: row.assigned_at,
      expires_at: row.expires_at ?? null,
      scope_namespace: row.scope_namespace ?? null,
      delegation_allowed: Boolean(row.delegation_allowed),
      status: row.status,
    };
  }

  private toIndependentReview(row: IndependentReviewRow): IndependentReviewRecord {
    return {
      review_id: row.review_id,
      decision_id: row.decision_id,
      reviewer_principal_id: row.reviewer_principal_id,
      reviewer_role_id: row.reviewer_role_id,
      position: row.position,
      reasoning: row.reasoning,
      risk_categories_addressed: JSON.parse(row.risk_categories_addressed),
      evidence_ids: JSON.parse(row.evidence_ids),
    };
  }
}

type RoleRow = {
  role_id: string;
  display_name: string;
  scope: string;
  capabilities: string;
  constraints: string;
  risk_threshold: number | null;
  escalation_target: string | null;
  status: Role["status"];
};

type RoleAssignmentRow = {
  assignment_id: string;
  principal_id: string;
  role_id: string;
  assigned_by: string;
  assigned_at: string;
  expires_at: string | null;
  scope_namespace: string | null;
  delegation_allowed: number;
  status: RoleAssignment["status"];
};

type IndependentReviewRow = {
  review_id: string;
  decision_id: string;
  reviewer_principal_id: string;
  reviewer_role_id: string;
  position: IndependentReviewRecord["position"];
  reasoning: string;
  risk_categories_addressed: string;
  evidence_ids: string;
  created_at: string;
};
