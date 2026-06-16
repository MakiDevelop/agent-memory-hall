import type Database from "better-sqlite3";
import type { GovernanceRule } from "./types.js";
import type { GovernancePlaneStore } from "./store.js";

export class SqliteGovernanceStore implements GovernancePlaneStore {
  constructor(private readonly db: Database.Database) {
    this.migrate();
  }

  migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS governance_rules (
        rule_id TEXT PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active',
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        specification TEXT NOT NULL,
        enforced_at_layers TEXT NOT NULL,
        created_by_decision TEXT
      );
    `);
  }

  async putRule(rule: GovernanceRule): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO governance_rules
        (rule_id, version, status, category, title, specification, enforced_at_layers, created_by_decision)
      VALUES (@rule_id, @version, @status, @category, @title, @specification, @enforced_at_layers, @created_by_decision)
    `).run({
      rule_id: rule.rule_id,
      version: rule.version,
      status: rule.status,
      category: rule.category,
      title: rule.title,
      specification: rule.specification,
      enforced_at_layers: JSON.stringify(rule.enforced_at_layers),
      created_by_decision: rule.created_by_decision ?? null,
    });
  }

  async getRule(ruleId: string): Promise<GovernanceRule | null> {
    const row = this.db.prepare("SELECT * FROM governance_rules WHERE rule_id = ?").get(ruleId) as any;
    if (!row) return null;
    return {
      ...row,
      enforced_at_layers: JSON.parse(row.enforced_at_layers),
      created_by_decision: row.created_by_decision ?? null,
    };
  }

  async getAllActiveRules(): Promise<GovernanceRule[]> {
    const rows = this.db.prepare("SELECT * FROM governance_rules WHERE status = 'active'").all() as any[];
    return rows.map(row => ({
      ...row,
      enforced_at_layers: JSON.parse(row.enforced_at_layers),
      created_by_decision: row.created_by_decision ?? null,
    }));
  }

  async patchRuleStatus(ruleId: string, status: GovernanceRule["status"]): Promise<void> {
    this.db.prepare("UPDATE governance_rules SET status = ? WHERE rule_id = ?").run(status, ruleId);
  }

  async cleanup(): Promise<void> {
    this.db.exec("DELETE FROM governance_rules");
  }
}
