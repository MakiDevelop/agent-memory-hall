import pg from "pg";
import type { AmhStore } from "./interface.js";
import type { AmhRecord, AuditEvent, AmhQuery, ProvenanceChain, SourceTier, TrustProof } from "../schema/types.js";

export class PostgresStore implements AmhStore {
  private pool: pg.Pool;
  private migrated = false;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString });
  }

  private async ensureMigrated(): Promise<void> {
    if (this.migrated) return;
    const client = await this.pool.connect();
    try {
      await client.query(`
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

        ALTER TABLE memories ADD COLUMN IF NOT EXISTS trust_proof TEXT;
        ALTER TABLE memories ADD COLUMN IF NOT EXISTS provenance_chain TEXT;

        CREATE INDEX IF NOT EXISTS idx_pg_memories_namespace ON memories(namespace);
        CREATE INDEX IF NOT EXISTS idx_pg_memories_type ON memories(memory_type);
        CREATE INDEX IF NOT EXISTS idx_pg_memories_agent ON memories(agent_id);
        CREATE INDEX IF NOT EXISTS idx_pg_memories_status ON memories(status);
        CREATE INDEX IF NOT EXISTS idx_pg_memories_hash ON memories(content_hash);

        CREATE TABLE IF NOT EXISTS audit_log (
          event_id TEXT PRIMARY KEY,
          memory_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          agent_id TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          details TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_pg_audit_memory ON audit_log(memory_id);
      `);
      this.migrated = true;
    } finally {
      client.release();
    }
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
      trust_proof: row.trust_proof ? JSON.parse(row.trust_proof) as TrustProof : undefined,
      provenance_chain: row.provenance_chain ? JSON.parse(row.provenance_chain) as ProvenanceChain : undefined,
    };
  }

  async put(record: AmhRecord): Promise<void> {
    await this.ensureMigrated();
    await this.pool.query(
      `INSERT INTO memories
        (memory_id, amh_version, version, status, agent_id, namespace, memory_type,
         content_format, content_value, source_type, source_ref, source_tier,
         created_at, created_by, valid_until, supersedes, content_hash, trust_proof, provenance_chain)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (memory_id) DO UPDATE SET
         amh_version=$2, version=$3, status=$4, agent_id=$5, namespace=$6, memory_type=$7,
         content_format=$8, content_value=$9, source_type=$10, source_ref=$11, source_tier=$12,
         created_at=$13, created_by=$14, valid_until=$15, supersedes=$16, content_hash=$17,
         trust_proof=$18, provenance_chain=$19`,
      [
        record.memory_id, record.amh_version, record.version, record.status,
        record.agent_id, record.namespace, record.memory_type,
        record.content.format, record.content.value,
        record.source.type, record.source.ref, record.source.tier,
        record.created_at, record.created_by,
        record.valid_until ?? null, record.supersedes ?? null, record.content_hash ?? null,
        record.trust_proof ? JSON.stringify(record.trust_proof) : null,
        record.provenance_chain ? JSON.stringify(record.provenance_chain) : null,
      ]
    );
  }

  async patchMetadata(memoryId: string, metadata: Record<string, unknown>): Promise<void> {
    await this.ensureMigrated();
    const sets: string[] = [];
    const params: unknown[] = [];
    const mapping: Record<string, string> = {
      amh_status: "status",
      amh_version: "amh_version",
      source_tier: "source_tier",
      trust_proof: "trust_proof",
      provenance_chain: "provenance_chain",
    };

    for (const [key, column] of Object.entries(mapping)) {
      if (key in metadata) {
        params.push(metadata[key]);
        sets.push(`${column} = $${params.length}`);
      }
    }

    if (sets.length === 0) return;
    params.push(memoryId);
    await this.pool.query(`UPDATE memories SET ${sets.join(", ")} WHERE memory_id = $${params.length}`, params);
  }

  async patchTier(memoryId: string, newTier: SourceTier, trustProof: TrustProof): Promise<void> {
    await this.ensureMigrated();
    await this.pool.query(
      "UPDATE memories SET source_tier = $1, trust_proof = $2 WHERE memory_id = $3",
      [newTier, JSON.stringify(trustProof), memoryId]
    );
  }

  async get(memoryId: string): Promise<AmhRecord | null> {
    await this.ensureMigrated();
    const { rows } = await this.pool.query("SELECT * FROM memories WHERE memory_id = $1", [memoryId]);
    return rows.length > 0 ? this.toRecord(rows[0]) : null;
  }

  async findByContentHash(namespace: string, contentHash: string): Promise<AmhRecord | null> {
    await this.ensureMigrated();
    const { rows } = await this.pool.query(
      "SELECT * FROM memories WHERE namespace = $1 AND content_hash = $2 AND status = 'active' LIMIT 1",
      [namespace, contentHash]
    );
    return rows.length > 0 ? this.toRecord(rows[0]) : null;
  }

  async query(filter: AmhQuery): Promise<AmhRecord[]> {
    await this.ensureMigrated();
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filter.memory_id) {
      conditions.push(`memory_id = $${idx++}`);
      params.push(filter.memory_id);
    }
    if (filter.namespace) {
      conditions.push(`namespace = $${idx++}`);
      params.push(filter.namespace);
    }
    if (filter.memory_type) {
      if (filter.memory_type === "fact") {
        conditions.push(`memory_type IN ('fact', 'decision')`);
      } else {
        conditions.push(`memory_type = $${idx++}`);
        params.push(filter.memory_type);
      }
    }
    if (filter.agent_id) {
      conditions.push(`agent_id = $${idx++}`);
      params.push(filter.agent_id);
    }
    if (filter.status) {
      conditions.push(`status = $${idx++}`);
      params.push(filter.status);
    }
    if (filter.text) {
      conditions.push(`content_value ILIKE $${idx++}`);
      params.push(`%${filter.text}%`);
    }

    let sql = "SELECT * FROM memories";
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY created_at DESC";
    if (filter.limit) {
      sql += ` LIMIT $${idx++}`;
      params.push(filter.limit);
    }

    const { rows } = await this.pool.query(sql, params);
    return rows.map((r: any) => this.toRecord(r));
  }

  async delete(memoryId: string): Promise<boolean> {
    await this.ensureMigrated();
    const result = await this.pool.query("DELETE FROM memories WHERE memory_id = $1", [memoryId]);
    return (result.rowCount ?? 0) > 0;
  }

  async list(namespace?: string): Promise<AmhRecord[]> {
    await this.ensureMigrated();
    let rows;
    if (namespace) {
      const result = await this.pool.query(
        "SELECT * FROM memories WHERE namespace = $1 ORDER BY created_at DESC", [namespace]
      );
      rows = result.rows;
    } else {
      const result = await this.pool.query("SELECT * FROM memories ORDER BY created_at DESC");
      rows = result.rows;
    }
    return rows.map((r: any) => this.toRecord(r));
  }

  async appendAudit(event: AuditEvent): Promise<void> {
    await this.ensureMigrated();
    await this.pool.query(
      `INSERT INTO audit_log (event_id, memory_id, operation, agent_id, timestamp, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [event.event_id, event.memory_id, event.operation, event.principal_id, event.timestamp, event.details ?? null]
    );
  }

  async getAudit(memoryId: string): Promise<AuditEvent[]> {
    await this.ensureMigrated();
    const { rows } = await this.pool.query(
      "SELECT * FROM audit_log WHERE memory_id = $1 ORDER BY timestamp", [memoryId]
    );
    return rows.map((r: any) => ({
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
    await this.ensureMigrated();
    const { rows } = await this.pool.query("SELECT COUNT(*) as cnt FROM memories");
    return parseInt(rows[0].cnt, 10);
  }

  async namespaces(): Promise<string[]> {
    await this.ensureMigrated();
    const { rows } = await this.pool.query("SELECT DISTINCT namespace FROM memories ORDER BY namespace");
    return rows.map((r: any) => r.namespace);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
