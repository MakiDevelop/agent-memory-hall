import type Database from "better-sqlite3";
import type { Grant, Principal } from "./types.js";
import type { IdentityStore } from "./store.js";

export class SqliteIdentityStore implements IdentityStore {
  constructor(private readonly db: Database.Database) {
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS principals (
        principal_id TEXT PRIMARY KEY,
        principal_type TEXT NOT NULL,
        display_name TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS grants (
        grant_id TEXT PRIMARY KEY,
        granter_principal_id TEXT NOT NULL,
        grantee_principal_id TEXT NOT NULL,
        namespace_id TEXT NOT NULL,
        permissions TEXT NOT NULL,
        granted_at TEXT NOT NULL,
        expires_at TEXT,
        status TEXT NOT NULL DEFAULT 'active'
      );

      CREATE INDEX IF NOT EXISTS idx_grants_grantee_ns ON grants(grantee_principal_id, namespace_id);
    `);
  }

  async putPrincipal(principal: Principal): Promise<void> {
    this.db.prepare(`
      INSERT INTO principals (principal_id, principal_type, display_name, status, created_at)
      VALUES (@principal_id, @principal_type, @display_name, @status, @created_at)
    `).run({
      principal_id: principal.principal_id,
      principal_type: principal.principal_type,
      display_name: principal.display_name ?? null,
      status: principal.status,
      created_at: principal.created_at,
    });
  }

  async getPrincipal(principalId: string): Promise<Principal | null> {
    const row = this.db.prepare("SELECT * FROM principals WHERE principal_id = ?").get(principalId) as any;
    if (!row) return null;
    return {
      principal_id: row.principal_id,
      principal_type: row.principal_type,
      display_name: row.display_name ?? undefined,
      status: row.status,
      created_at: row.created_at,
    };
  }

  async putGrant(grant: Grant): Promise<void> {
    this.db.prepare(`
      INSERT INTO grants
        (grant_id, granter_principal_id, grantee_principal_id, namespace_id, permissions, granted_at, expires_at, status)
      VALUES
        (@grant_id, @granter_principal_id, @grantee_principal_id, @namespace_id, @permissions, @granted_at, @expires_at, @status)
    `).run({
      grant_id: grant.grant_id,
      granter_principal_id: grant.granter_principal_id,
      grantee_principal_id: grant.grantee_principal_id,
      namespace_id: grant.namespace_id,
      permissions: JSON.stringify(grant.permissions),
      granted_at: grant.granted_at,
      expires_at: grant.expires_at ?? null,
      status: grant.status,
    });
  }

  async getGrant(grantId: string): Promise<Grant | null> {
    const row = this.db.prepare("SELECT * FROM grants WHERE grant_id = ?").get(grantId) as any;
    return row ? this.toGrant(row) : null;
  }

  async getGrantsForPrincipal(principalId: string, namespaceId: string): Promise<Grant[]> {
    const rows = this.db.prepare(`
      SELECT * FROM grants
      WHERE grantee_principal_id = ? AND namespace_id = ?
      ORDER BY granted_at DESC
    `).all(principalId, namespaceId) as any[];
    return rows.map((row) => this.toGrant(row));
  }

  async revokeGrant(grantId: string): Promise<void> {
    this.db.prepare("UPDATE grants SET status = 'revoked' WHERE grant_id = ?").run(grantId);
  }

  async listPrincipals(): Promise<Principal[]> {
    const rows = this.db.prepare("SELECT * FROM principals ORDER BY created_at DESC").all() as any[];
    return rows.map((row) => ({
      principal_id: row.principal_id,
      principal_type: row.principal_type,
      display_name: row.display_name ?? undefined,
      status: row.status,
      created_at: row.created_at,
    }));
  }

  async updatePrincipalStatus(principalId: string, status: Principal["status"]): Promise<void> {
    this.db.prepare("UPDATE principals SET status = ? WHERE principal_id = ?").run(status, principalId);
  }

  private toGrant(row: any): Grant {
    return {
      grant_id: row.grant_id,
      granter_principal_id: row.granter_principal_id,
      grantee_principal_id: row.grantee_principal_id,
      namespace_id: row.namespace_id,
      permissions: JSON.parse(row.permissions),
      granted_at: row.granted_at,
      expires_at: row.expires_at ?? undefined,
      status: row.status,
    };
  }
}
