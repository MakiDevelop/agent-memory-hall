import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AmhStore } from "./interface.js";
import type { AmhRecord, AuditEvent, AmhQuery, ProvenanceChain, SourceTier, TrustProof } from "../schema/types.js";

export class SqliteStore implements AmhStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const path = dbPath ?? join(homedir(), ".amh", "memory.db");
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        memory_id TEXT PRIMARY KEY,
        amh_version TEXT NOT NULL DEFAULT '0.1',
        version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active',
        agent_id TEXT NOT NULL,
        namespace TEXT NOT NULL,
        memory_type TEXT NOT NULL,
        content_format TEXT NOT NULL DEFAULT 'text/plain',
        content_value TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_ref TEXT NOT NULL DEFAULT '',
        source_tier TEXT NOT NULL DEFAULT 'llm_derived',
        created_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        valid_until TEXT,
        supersedes TEXT,
        content_hash TEXT,
        trust_proof TEXT,
        provenance_chain TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_memories_namespace ON memories(namespace);
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
      CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agent_id);
      CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status);
      CREATE INDEX IF NOT EXISTS idx_memories_hash ON memories(content_hash);

      CREATE TABLE IF NOT EXISTS audit_log (
        event_id TEXT PRIMARY KEY,
        memory_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        details TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_audit_memory ON audit_log(memory_id);
    `);
    this.addColumnIfMissing("memories", "trust_proof", "TEXT");
    this.addColumnIfMissing("memories", "provenance_chain", "TEXT");
  }

  private addColumnIfMissing(table: string, column: string, definition: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((c) => c.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  private parseJson<T>(value: string | null | undefined): T | undefined {
    if (!value) return undefined;
    return JSON.parse(value) as T;
  }

  private toRecord(row: any): AmhRecord {
    return {
      amh_version: row.amh_version,
      memory_id: row.memory_id,
      version: row.version,
      status: row.status,
      agent_id: row.agent_id,
      namespace: row.namespace,
      memory_type: row.memory_type === "decision" ? "fact" : row.memory_type,
      content: { format: row.content_format, value: row.content_value },
      source: { type: row.source_type, ref: row.source_ref, tier: row.source_tier },
      created_at: row.created_at,
      created_by: row.created_by,
      valid_until: row.valid_until ?? undefined,
      supersedes: row.supersedes ?? undefined,
      content_hash: row.content_hash ?? undefined,
      trust_proof: this.parseJson<TrustProof>(row.trust_proof),
      provenance_chain: this.parseJson<ProvenanceChain>(row.provenance_chain),
    };
  }

  async put(record: AmhRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memories
        (memory_id, amh_version, version, status, agent_id, namespace, memory_type,
         content_format, content_value, source_type, source_ref, source_tier,
         created_at, created_by, valid_until, supersedes, content_hash, trust_proof, provenance_chain)
      VALUES
        (@memory_id, @amh_version, @version, @status, @agent_id, @namespace, @memory_type,
         @content_format, @content_value, @source_type, @source_ref, @source_tier,
         @created_at, @created_by, @valid_until, @supersedes, @content_hash, @trust_proof, @provenance_chain)
    `);
    stmt.run({
      memory_id: record.memory_id,
      amh_version: record.amh_version,
      version: record.version,
      status: record.status,
      agent_id: record.agent_id,
      namespace: record.namespace,
      memory_type: record.memory_type,
      content_format: record.content.format,
      content_value: record.content.value,
      source_type: record.source.type,
      source_ref: record.source.ref,
      source_tier: record.source.tier,
      created_at: record.created_at,
      created_by: record.created_by,
      valid_until: record.valid_until ?? null,
      supersedes: record.supersedes ?? null,
      content_hash: record.content_hash ?? null,
      trust_proof: record.trust_proof ? JSON.stringify(record.trust_proof) : null,
      provenance_chain: record.provenance_chain ? JSON.stringify(record.provenance_chain) : null,
    });
  }

  async patchMetadata(memoryId: string, metadata: Record<string, unknown>): Promise<void> {
    const sets: string[] = [];
    const params: Record<string, unknown> = { memory_id: memoryId };

    const mapping: Record<string, string> = {
      amh_status: "status",
      amh_version: "amh_version",
      source_tier: "source_tier",
      trust_proof: "trust_proof",
      provenance_chain: "provenance_chain",
    };

    for (const [key, column] of Object.entries(mapping)) {
      if (key in metadata) {
        sets.push(`${column} = @${column}`);
        params[column] = metadata[key];
      }
    }

    if (sets.length === 0) return;
    this.db.prepare(`UPDATE memories SET ${sets.join(", ")} WHERE memory_id = @memory_id`).run(params);
  }

  async patchTier(memoryId: string, newTier: SourceTier, trustProof: TrustProof): Promise<void> {
    this.db.prepare("UPDATE memories SET source_tier = ?, trust_proof = ? WHERE memory_id = ?")
      .run(newTier, JSON.stringify(trustProof), memoryId);
  }

  async get(memoryId: string): Promise<AmhRecord | null> {
    const row = this.db.prepare("SELECT * FROM memories WHERE memory_id = ?").get(memoryId);
    return row ? this.toRecord(row) : null;
  }

  async findByContentHash(namespace: string, contentHash: string): Promise<AmhRecord | null> {
    const row = this.db.prepare(
      "SELECT * FROM memories WHERE namespace = ? AND content_hash = ? AND status = 'active' LIMIT 1"
    ).get(namespace, contentHash);
    return row ? this.toRecord(row) : null;
  }

  async query(filter: AmhQuery): Promise<AmhRecord[]> {
    const conditions: string[] = [];
    const params: any = {};

    if (filter.memory_id) {
      conditions.push("memory_id = @memory_id");
      params.memory_id = filter.memory_id;
    }
    if (filter.namespace) {
      conditions.push("namespace = @namespace");
      params.namespace = filter.namespace;
    }
    if (filter.memory_type) {
      if (filter.memory_type === "fact") {
        conditions.push("memory_type IN ('fact', 'decision')");
      } else {
        conditions.push("memory_type = @memory_type");
        params.memory_type = filter.memory_type;
      }
    }
    if (filter.agent_id) {
      conditions.push("agent_id = @agent_id");
      params.agent_id = filter.agent_id;
    }
    if (filter.status) {
      conditions.push("status = @status");
      params.status = filter.status;
    }
    if (filter.text) {
      conditions.push("content_value LIKE @text");
      params.text = `%${filter.text}%`;
    }

    let sql = "SELECT * FROM memories";
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY created_at DESC";
    if (filter.limit) {
      sql += ` LIMIT ${filter.limit}`;
    }

    const rows = this.db.prepare(sql).all(params);
    return rows.map((r: any) => this.toRecord(r));
  }

  async delete(memoryId: string): Promise<boolean> {
    const result = this.db.prepare("DELETE FROM memories WHERE memory_id = ?").run(memoryId);
    return result.changes > 0;
  }

  async list(namespace?: string): Promise<AmhRecord[]> {
    let rows;
    if (namespace) {
      rows = this.db.prepare("SELECT * FROM memories WHERE namespace = ? ORDER BY created_at DESC").all(namespace);
    } else {
      rows = this.db.prepare("SELECT * FROM memories ORDER BY created_at DESC").all();
    }
    return rows.map((r: any) => this.toRecord(r));
  }

  async appendAudit(event: AuditEvent): Promise<void> {
    this.db.prepare(`
      INSERT INTO audit_log (event_id, memory_id, operation, agent_id, timestamp, details)
      VALUES (@event_id, @memory_id, @operation, @agent_id, @timestamp, @details)
    `).run({
      event_id: event.event_id,
      memory_id: event.memory_id,
      operation: event.operation,
      agent_id: event.principal_id,
      timestamp: event.timestamp,
      details: event.details ?? null,
    });
  }

  async getAudit(memoryId: string): Promise<AuditEvent[]> {
    const rows = this.db.prepare(
      "SELECT * FROM audit_log WHERE memory_id = ? ORDER BY timestamp"
    ).all(memoryId) as any[];
    return rows.map((r) => ({
      event_id: r.event_id,
      memory_id: r.memory_id,
      operation: r.operation,
      principal_id: r.agent_id ?? r.principal_id,
      timestamp: r.timestamp,
      correlation_id: r.correlation_id,
      details: r.details,
    }));
  }

  async count(): Promise<number> {
    const row = this.db.prepare("SELECT COUNT(*) as cnt FROM memories").get() as any;
    return row.cnt;
  }

  async namespaces(): Promise<string[]> {
    const rows = this.db.prepare("SELECT DISTINCT namespace FROM memories ORDER BY namespace").all() as any[];
    return rows.map((r) => r.namespace);
  }
}
