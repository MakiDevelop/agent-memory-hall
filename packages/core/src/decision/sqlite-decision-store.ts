import type Database from "better-sqlite3";
import type { Decision, DecisionStatus, RatificationRecord } from "./types.js";
import type { DecisionStore } from "./store.js";

export class SqliteDecisionStore implements DecisionStore {
  constructor(private readonly db: Database.Database) {
    this.migrate();
  }

  migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS decisions (
        decision_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'proposed',
        risk_level TEXT NOT NULL,
        proposer_principal_id TEXT NOT NULL,
        proposal TEXT NOT NULL,
        ratification TEXT,
        created_at TEXT NOT NULL,
        effective_at TEXT,
        review_deadline TEXT,
        supersedes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
      CREATE INDEX IF NOT EXISTS idx_decisions_proposer ON decisions(proposer_principal_id);
    `);
  }

  async putDecision(decision: Decision): Promise<void> {
    this.db.prepare(`
      INSERT INTO decisions
        (decision_id, title, status, risk_level, proposer_principal_id, proposal, ratification, created_at, effective_at, review_deadline, supersedes)
      VALUES
        (@decision_id, @title, @status, @risk_level, @proposer_principal_id, @proposal, @ratification, @created_at, @effective_at, @review_deadline, @supersedes)
    `).run({
      decision_id: decision.decision_id,
      title: decision.title,
      status: decision.status,
      risk_level: decision.risk_level,
      proposer_principal_id: decision.proposer_principal_id,
      proposal: JSON.stringify(decision.proposal),
      ratification: decision.ratification ? JSON.stringify(decision.ratification) : null,
      created_at: decision.created_at,
      effective_at: decision.effective_at ?? null,
      review_deadline: decision.review_deadline ?? null,
      supersedes: decision.supersedes ?? null,
    });
  }

  async getDecision(decisionId: string): Promise<Decision | null> {
    const row = this.db.prepare("SELECT * FROM decisions WHERE decision_id = ?").get(decisionId) as DecisionRow | undefined;
    if (!row) return null;
    return {
      decision_id: row.decision_id,
      title: row.title,
      status: row.status as DecisionStatus,
      risk_level: row.risk_level as Decision["risk_level"],
      proposer_principal_id: row.proposer_principal_id,
      proposal: JSON.parse(row.proposal),
      reviews: [],
      ratification: row.ratification ? JSON.parse(row.ratification) : null,
      created_at: row.created_at,
      effective_at: row.effective_at ?? null,
      review_deadline: row.review_deadline ?? null,
      supersedes: row.supersedes ?? null,
    };
  }

  async patchDecisionStatus(
    decisionId: string,
    status: DecisionStatus,
    extra?: {
      ratification?: RatificationRecord;
      effective_at?: string;
      review_deadline?: string;
    },
  ): Promise<void> {
    const sets: string[] = ["status = ?"];
    const params: any[] = [status];

    if (extra?.ratification) {
      sets.push("ratification = ?");
      params.push(JSON.stringify(extra.ratification));
    }
    if (extra?.effective_at) {
      sets.push("effective_at = ?");
      params.push(extra.effective_at);
    }
    if (extra?.review_deadline) {
      sets.push("review_deadline = ?");
      params.push(extra.review_deadline);
    }

    params.push(decisionId);
    this.db.prepare(`UPDATE decisions SET ${sets.join(", ")} WHERE decision_id = ?`).run(...params);
  }

  async cleanup(): Promise<void> {
    this.db.exec("DELETE FROM decisions");
  }
}

type DecisionRow = {
  decision_id: string;
  title: string;
  status: string;
  risk_level: string;
  proposer_principal_id: string;
  proposal: string;
  ratification: string | null;
  created_at: string;
  effective_at: string | null;
  review_deadline: string | null;
  supersedes: string | null;
};
