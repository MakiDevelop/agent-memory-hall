import type Database from "better-sqlite3";
import type { ObligationStore } from "./store.js";
import type {
  ActionType,
  AuditEntry,
  ObligationPacket,
  ObligationStatus,
  PolicyEvaluation,
} from "./types.js";

export class SqliteObligationStore implements ObligationStore {
  constructor(private readonly db: Database.Database) {
    this.migrate();
  }

  migrate(): void {
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS obligations (
        obligation_id TEXT PRIMARY KEY,
        promise TEXT NOT NULL,
        owner TEXT NOT NULL,
        fallback_owner TEXT NOT NULL,
        status TEXT NOT NULL,
        evidence TEXT NOT NULL,
        missing_evidence TEXT NOT NULL,
        blocked_by TEXT NOT NULL,
        stale_if TEXT NOT NULL,
        allowed_next_actions TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_touched_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_obligations_status ON obligations(status);
      CREATE INDEX IF NOT EXISTS idx_obligations_owner ON obligations(owner);

      CREATE TABLE IF NOT EXISTS obligation_evaluations (
        obligation_id TEXT PRIMARY KEY,
        risk_tier TEXT NOT NULL,
        operation_permissions TEXT NOT NULL,
        evaluator_id TEXT NOT NULL,
        evaluated_at TEXT NOT NULL,
        policy_version TEXT NOT NULL,
        evaluator_scope TEXT NOT NULL,
        evidence_refs TEXT NOT NULL,
        bound_obligation_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS obligation_audit (
        audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
        obligation_id TEXT NOT NULL,
        type TEXT NOT NULL,
        details TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_obligation_audit_obligation ON obligation_audit(obligation_id, timestamp);
    `);
  }

  async putObligation(packet: ObligationPacket, evaluation: PolicyEvaluation): Promise<void> {
    const insert = this.db.transaction(() => {
      this.db.prepare(`
        INSERT OR REPLACE INTO obligations
          (obligation_id, promise, owner, fallback_owner, status, evidence, missing_evidence, blocked_by, stale_if, allowed_next_actions, created_at, last_touched_at)
        VALUES
          (@obligation_id, @promise, @owner, @fallback_owner, @status, @evidence, @missing_evidence, @blocked_by, @stale_if, @allowed_next_actions, @created_at, @last_touched_at)
      `).run({
        obligation_id: packet.obligation_id,
        promise: packet.promise,
        owner: packet.owner,
        fallback_owner: packet.fallback_owner,
        status: packet.status,
        evidence: JSON.stringify(packet.evidence),
        missing_evidence: JSON.stringify(packet.missing_evidence),
        blocked_by: JSON.stringify(packet.blocked_by),
        stale_if: JSON.stringify(packet.stale_if),
        allowed_next_actions: JSON.stringify(packet.allowed_next_actions),
        created_at: packet.created_at,
        last_touched_at: packet.last_touched_at,
      });

      this.db.prepare(`
        INSERT OR REPLACE INTO obligation_evaluations
          (obligation_id, risk_tier, operation_permissions, evaluator_id, evaluated_at, policy_version, evaluator_scope, evidence_refs, bound_obligation_id)
        VALUES
          (@obligation_id, @risk_tier, @operation_permissions, @evaluator_id, @evaluated_at, @policy_version, @evaluator_scope, @evidence_refs, @bound_obligation_id)
      `).run({
        obligation_id: packet.obligation_id,
        risk_tier: evaluation.risk_tier,
        operation_permissions: JSON.stringify(evaluation.operation_permissions),
        evaluator_id: evaluation.evaluator_id,
        evaluated_at: evaluation.evaluated_at,
        policy_version: evaluation.policy_version,
        evaluator_scope: evaluation.evaluator_scope,
        evidence_refs: JSON.stringify(evaluation.evidence_refs),
        bound_obligation_id: evaluation.bound_obligation_id,
      });
    });

    insert();
  }

  async getObligation(id: string): Promise<ObligationPacket | null> {
    const row = this.db.prepare("SELECT * FROM obligations WHERE obligation_id = ?").get(id) as
      | ObligationRow
      | undefined;
    return row ? this.toObligation(row) : null;
  }

  async getEvaluation(id: string): Promise<PolicyEvaluation | null> {
    const row = this.db.prepare("SELECT * FROM obligation_evaluations WHERE obligation_id = ?").get(id) as
      | EvaluationRow
      | undefined;
    return row ? this.toEvaluation(row) : null;
  }

  async patchStatus(id: string, status: ObligationStatus): Promise<void> {
    this.db.prepare(`
      UPDATE obligations
      SET status = ?, last_touched_at = ?
      WHERE obligation_id = ?
    `).run(status, new Date().toISOString(), id);
  }

  async patchAllowedActions(id: string, actions: ActionType[]): Promise<void> {
    this.db.prepare(`
      UPDATE obligations
      SET allowed_next_actions = ?, last_touched_at = ?
      WHERE obligation_id = ?
    `).run(JSON.stringify(actions), new Date().toISOString(), id);
  }

  async appendAudit(obligationId: string, entry: AuditEntry): Promise<void> {
    this.db.prepare(`
      INSERT INTO obligation_audit (obligation_id, type, details, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(obligationId, entry.type, entry.details, entry.timestamp);
  }

  async cleanup(): Promise<void> {
    this.db.exec(`
      DELETE FROM obligation_audit;
      DELETE FROM obligation_evaluations;
      DELETE FROM obligations;
    `);
  }

  private toObligation(row: ObligationRow): ObligationPacket {
    return {
      obligation_id: row.obligation_id,
      promise: row.promise,
      owner: row.owner,
      fallback_owner: row.fallback_owner,
      status: row.status,
      evidence: JSON.parse(row.evidence),
      missing_evidence: JSON.parse(row.missing_evidence),
      blocked_by: JSON.parse(row.blocked_by),
      stale_if: JSON.parse(row.stale_if),
      allowed_next_actions: JSON.parse(row.allowed_next_actions),
      created_at: row.created_at,
      last_touched_at: row.last_touched_at,
    };
  }

  private toEvaluation(row: EvaluationRow): PolicyEvaluation {
    return {
      risk_tier: row.risk_tier,
      operation_permissions: JSON.parse(row.operation_permissions),
      evaluator_id: row.evaluator_id,
      evaluated_at: row.evaluated_at,
      policy_version: row.policy_version,
      evaluator_scope: row.evaluator_scope,
      evidence_refs: JSON.parse(row.evidence_refs),
      bound_obligation_id: row.bound_obligation_id,
    };
  }
}

type ObligationRow = {
  obligation_id: string;
  promise: string;
  owner: string;
  fallback_owner: string;
  status: ObligationStatus;
  evidence: string;
  missing_evidence: string;
  blocked_by: string;
  stale_if: string;
  allowed_next_actions: string;
  created_at: string;
  last_touched_at: string;
};

type EvaluationRow = {
  obligation_id: string;
  risk_tier: PolicyEvaluation["risk_tier"];
  operation_permissions: string;
  evaluator_id: string;
  evaluated_at: string;
  policy_version: string;
  evaluator_scope: string;
  evidence_refs: string;
  bound_obligation_id: string;
};
