import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import type { AmhStore } from "./interface.js";
import type { AmhRecord, AuditEvent, AmhQuery } from "../schema/types.js";
import { computeContentHash } from "../governance/dedup.js";
import { withFileLock } from "./file-lock.js";

interface MemhallWriteResponse {
  entry_id: string;
  created: boolean;
  deduplicated: boolean;
  status_code: number;
}

interface MemhallEntry {
  entry_id: string;
  tenant_id: string;
  agent_id: string;
  namespace: string;
  type: string;
  content: string;
  content_hash: string;
  summary: string | null;
  tags: string[];
  references: string[];
  metadata: Record<string, unknown>;
  sync_status: string;
  created_at: string;
  created_by_principal: string;
}

interface MemhallSearchResult {
  results: Array<{
    entry: MemhallEntry;
    score?: number;
  }>;
  total?: number;
}

const MEMHALL_SEARCH_LIMIT_MAX = 100;

function normalizeSearchLimit(limit: number | undefined): number {
  return Math.min(limit ?? 20, MEMHALL_SEARCH_LIMIT_MAX);
}

export class MemhallApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "MemhallApiError";
  }
}

const VALID_STATUS = new Set<AmhRecord["status"]>(["active", "superseded", "revoked", "expired"]);

function amhStatusFromMeta(meta: Record<string, unknown>): AmhRecord["status"] {
  const status = meta.amh_status;
  return typeof status === "string" && VALID_STATUS.has(status as AmhRecord["status"])
    ? (status as AmhRecord["status"])
    : "active";
}

function entryToAmh(entry: MemhallEntry): AmhRecord {
  const meta = entry.metadata ?? {};
  const trustProof = typeof meta.trust_proof === "string" ? JSON.parse(meta.trust_proof) : meta.trust_proof;
  const provenanceChain = typeof meta.provenance_chain === "string" ? JSON.parse(meta.provenance_chain) : meta.provenance_chain;
  return {
    amh_version: "0.1",
    memory_id: entry.entry_id,
    version: 1,
    status: amhStatusFromMeta(meta),
    agent_id: entry.agent_id,
    namespace: entry.namespace,
    memory_type: mapType(entry.type),
    content: {
      format: "text/plain",
      value: entry.content,
    },
    source: {
      type: (meta.source_type as AmhRecord["source"]["type"]) ?? "agent",
      ref: (meta.source_ref as string) ?? "",
      tier: (meta.source_tier as AmhRecord["source"]["tier"]) ?? "llm_derived",
    },
    created_at: entry.created_at,
    created_by: entry.created_by_principal,
    content_hash: entry.content_hash,
    // valid_until 由 amhMetadataFromRecord 寫進 metadata，但過去沒有還原回來，
    // 於是 AmhRecord.valid_until 恆為 undefined，isExpired() 的「時間到期」語義
    // 在 memhall backend 上從未生效（只有 status === "expired" 會被擋）。
    // （Codex review 2026-08-10 發現 #1）
    valid_until: typeof meta.valid_until === "string" ? meta.valid_until : undefined,
    trust_proof: trustProof as AmhRecord["trust_proof"],
    provenance_chain: provenanceChain as AmhRecord["provenance_chain"],
  };
}

function mapType(memhallType: string): AmhRecord["memory_type"] {
  const mapping: Record<string, AmhRecord["memory_type"]> = {
    episode: "lesson",
    decision: "fact",
    fact: "fact",
    preference: "preference",
    constraint: "constraint",
    risk: "risk",
    lesson: "lesson",
  };
  return mapping[memhallType] ?? "fact";
}

function reverseMapType(amhType: AmhRecord["memory_type"]): string {
  if (amhType === "lesson") return "episode";
  return amhType;
}

function amhMetadataFromRecord(record: AmhRecord): Record<string, unknown> {
  return {
    amh_version: record.amh_version,
    amh_status: record.status,
    source_type: record.source.type,
    source_ref: record.source.ref,
    source_tier: record.source.tier,
    valid_until: record.valid_until,
    supersedes: record.supersedes,
    amh_content_hash: computeContentHash(record.content.format, record.content.value),
    trust_proof: record.trust_proof ? JSON.stringify(record.trust_proof) : undefined,
    provenance_chain: record.provenance_chain ? JSON.stringify(record.provenance_chain) : undefined,
  };
}

function defaultAuditPath(baseUrl: string): string {
  const hash = createHash("sha256").update(baseUrl).digest("hex").slice(0, 16);
  return join(homedir(), ".amh", `memhall-audit-${hash}.json`);
}

/** First link of the chain, mirroring ~/.claude/evidence/vault.jsonl. */
const AUDIT_GENESIS = "genesis";

/**
 * Canonical serialisation an independent verifier must be able to reproduce.
 * Key order is written out explicitly rather than relying on object literal
 * ordering, so a future refactor cannot silently invalidate every stored hash.
 * `hash` itself is excluded — it is the output, not an input.
 */
function auditChainBody(event: AuditEvent, prevHash: string): string {
  return JSON.stringify({
    event_id: event.event_id,
    memory_id: event.memory_id,
    operation: event.operation,
    principal_id: event.principal_id,
    timestamp: event.timestamp,
    correlation_id: event.correlation_id ?? null,
    details: event.details ?? null,
    prev_hash: prevHash,
  });
}

function auditHash(event: AuditEvent, prevHash: string): string {
  return createHash("sha256").update(auditChainBody(event, prevHash)).digest("hex");
}

export interface AuditChainReport {
  /** Total events in the log. */
  total: number;
  /** Events whose hash reproduces from their own content. */
  verified: number;
  /** Pre-OL-013 events carrying no hash — not evidence of tampering. */
  unchained: number;
  /** 0-based indices whose hash or prev_hash link does not reconcile. */
  breaks: number[];
}

export class MemhallStore implements AmhStore {
  private baseUrl: string;
  private token: string;
  private auditPath: string;

  constructor(baseUrl: string, token: string, auditPath?: string) {
    if (!baseUrl) {
      throw new Error("Memhall store requires --path with the memhall API URL");
    }
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
    this.auditPath = auditPath ?? defaultAuditPath(this.baseUrl);
  }

  private async readAuditFile(): Promise<AuditEvent[]> {
    // A missing log is the only benign failure. Everything else used to be
    // swallowed into `[]`, which meant a single unreadable or truncated byte
    // caused the very next appendAudit() to rewrite the file with one event —
    // silently destroying the whole history. Tamper-evidence is worthless if
    // the reader erases the evidence on its way past.
    let raw: string;
    try {
      raw = await readFile(this.auditPath, "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw err;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `Audit log at ${this.auditPath} is not valid JSON (${(err as Error).message}). ` +
          `Refusing to read — appending now would overwrite the existing history. ` +
          `Move the file aside once you have inspected it.`,
      );
    }

    if (!Array.isArray(parsed)) {
      throw new Error(
        `Audit log at ${this.auditPath} is ${typeof parsed}, expected an array. Refusing to overwrite.`,
      );
    }

    return parsed as AuditEvent[];
  }

  private async api<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.token}`,
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new MemhallApiError(res.status, `memhall ${method} ${path} failed: ${res.status} ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async put(record: AmhRecord): Promise<void> {
    const payload: Record<string, unknown> = {
      agent_id: record.agent_id,
      namespace: record.namespace,
      type: reverseMapType(record.memory_type),
      content: record.content.value,
      tags: ["amh"],
      metadata: amhMetadataFromRecord(record),
    };

    const response = await this.api<MemhallWriteResponse>("POST", "/v1/memory/write", payload);
    record.memory_id = response.entry_id;
  }

  async patchMetadata(memoryId: string, metadata: Record<string, unknown>): Promise<void> {
    await this.api("PATCH", `/v1/memory/${memoryId}`, { metadata });
  }

  async linkSupersedes(childId: string, parentId: string): Promise<void> {
    await this.api("POST", `/v1/memory/${childId}/link`, {
      target_entry_id: parentId,
      relation: "supersedes",
    });
  }

  async get(memoryId: string): Promise<AmhRecord | null> {
    try {
      const entry = await this.api<{ entry: MemhallEntry }>(
        "GET",
        `/v1/memory/${memoryId}`
      );
      return entryToAmh(entry.entry);
    } catch {
      return null;
    }
  }

  async findByContentHash(namespace: string, contentHash: string): Promise<AmhRecord | null> {
    try {
      const lookup = await this.api<{ entry: MemhallEntry }>(
        "GET",
        `/v1/memory/by-amh-hash?namespace=${encodeURIComponent(namespace)}&hash=${encodeURIComponent(contentHash)}`
      );
      return entryToAmh(lookup.entry);
    } catch {
      return null;
    }
  }

  /**
   * Chronological list via GET /v1/memory (created_at DESC).
   * Use this for handoff / latest-state — NOT hybrid search.
   */
  async listLatest(filter: {
    namespace?: string;
    memory_type?: AmhRecord["memory_type"];
    agent_id?: string;
    limit?: number;
  } = {}): Promise<AmhRecord[]> {
    const params = new URLSearchParams();
    params.set("limit", String(normalizeSearchLimit(filter.limit ?? 20)));
    if (filter.namespace) {
      params.append("namespace", filter.namespace);
    }
    if (filter.memory_type) {
      params.append("type", reverseMapType(filter.memory_type));
    }
    if (filter.agent_id) {
      params.set("agent_id", filter.agent_id);
    }

    const result = await this.api<{ entries: MemhallEntry[] }>(
      "GET",
      `/v1/memory?${params.toString()}`
    );
    const entries = Array.isArray(result.entries) ? result.entries : [];
    return entries.map(entryToAmh);
  }

  async query(filter: AmhQuery): Promise<AmhRecord[]> {
    // No text query → chronological list (handoff-safe). Text → hybrid search.
    if (!filter.text) {
      let records = await this.listLatest({
        namespace: filter.namespace,
        memory_type: filter.memory_type,
        agent_id: filter.agent_id,
        limit: filter.limit,
      });
      if (filter.status) {
        records = records.filter((r) => r.status === filter.status);
      }
      if (filter.memory_id) {
        records = records.filter((r) => r.memory_id === filter.memory_id);
      }
      return records;
    }

    const searchBody: Record<string, unknown> = {
      mode: "hybrid",
      limit: normalizeSearchLimit(filter.limit),
      query: filter.text,
    };

    if (filter.namespace) {
      searchBody.namespace = [filter.namespace];
    }

    const result = await this.api<MemhallSearchResult>(
      "POST",
      "/v1/memory/search",
      searchBody
    );

    let records = result.results.map((r) => entryToAmh(r.entry));

    if (filter.memory_type) {
      records = records.filter((r) => r.memory_type === filter.memory_type);
    }
    if (filter.agent_id) {
      records = records.filter((r) => r.agent_id === filter.agent_id);
    }
    if (filter.status) {
      records = records.filter((r) => r.status === filter.status);
    }
    if (filter.memory_id) {
      records = records.filter((r) => r.memory_id === filter.memory_id);
    }

    return records;
  }

  async delete(_memoryId: string): Promise<boolean> {
    throw new Error("MemhallStore does not support delete (governance: deletion requires memhall admin)");
  }

  async list(namespace?: string): Promise<AmhRecord[]> {
    return this.listLatest({ namespace, limit: 100 });
  }

  /** Probe primary for status honesty (fail-loud diagnostics). */
  async healthCheck(): Promise<{ ok: boolean; status?: number; error?: string }> {
    try {
      const url = `${this.baseUrl}/v1/memory?limit=1`;
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (!res.ok) {
        return { ok: false, status: res.status, error: await res.text() };
      }
      return { ok: true, status: res.status };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async appendAudit(event: AuditEvent): Promise<void> {
    await withFileLock(this.auditPath, async () => {
      const events = await this.readAuditFile();

      // Chain onto the last event. Events predating OL-013 have no hash, so the
      // chain restarts from genesis at the first event written after upgrade —
      // it cannot retroactively attest to history it never covered.
      const last = events[events.length - 1];
      const prevHash = last?.hash ?? AUDIT_GENESIS;

      events.push({ ...event, prev_hash: prevHash, hash: auditHash(event, prevHash) });

      const { writeFile } = await import("node:fs/promises");
      await mkdir(dirname(this.auditPath), { recursive: true });
      await writeFile(this.auditPath, JSON.stringify(events, null, 2), "utf-8");
    });
  }

  /**
   * Recompute the chain and report where it fails to reconcile (D6 AC6).
   * Read-only: it never rewrites the log, so it is safe to run against a
   * suspect file.
   */
  async verifyAuditChain(): Promise<AuditChainReport> {
    const events = await this.readAuditFile();
    const report: AuditChainReport = { total: events.length, verified: 0, unchained: 0, breaks: [] };

    let expectedPrev = AUDIT_GENESIS;
    for (const [index, event] of events.entries()) {
      if (!event.hash) {
        report.unchained += 1;
        // A gap resets the expectation; the next chained event legitimately
        // starts from genesis rather than from an unhashed predecessor.
        expectedPrev = AUDIT_GENESIS;
        continue;
      }

      const prevHash = event.prev_hash ?? AUDIT_GENESIS;
      const recomputed = auditHash(event, prevHash);
      if (prevHash !== expectedPrev || recomputed !== event.hash) {
        report.breaks.push(index);
      } else {
        report.verified += 1;
      }

      // Advance on what this event's content actually hashes to, not on the
      // value stored alongside it. Chaining on the stored hash would let an
      // edited body fail in isolation while every later link still reconciled —
      // tampering must cascade, or the chain only protects one record at a time.
      expectedPrev = recomputed;
    }

    return report;
  }

  async getAudit(memoryId: string): Promise<AuditEvent[]> {
    const events = await this.readAuditFile();
    return events.filter((e) => e.memory_id === memoryId);
  }

  async count(): Promise<number> {
    const result = await this.api<MemhallSearchResult>("POST", "/v1/memory/search", {
      mode: "hybrid",
      query: "*",
      limit: 1,
    });
    if (typeof result.total === "number") {
      return result.total;
    }
    const all = await this.query({ limit: MEMHALL_SEARCH_LIMIT_MAX });
    return all.length;
  }

  async namespaces(): Promise<string[]> {
    const results = await this.query({ limit: MEMHALL_SEARCH_LIMIT_MAX });
    return [...new Set(results.map((r) => r.namespace))];
  }

  async batonRead(namespace: string): Promise<{
    baton: Record<string, unknown> | null;
    namespace: string;
    updated_at: string | null;
    revision: number | null;
  }> {
    return this.api("POST", "/v1/baton/read", { namespace });
  }

  async batonWrite(
    namespace: string,
    baton: Record<string, unknown>,
    expectedRevision?: number
  ): Promise<{
    ok: boolean;
    updated_at: string;
    namespace: string;
    revision: number;
  }> {
    const body: Record<string, unknown> = { namespace, baton };
    if (expectedRevision !== undefined) {
      body.expected_revision = expectedRevision;
    }
    return this.api("POST", "/v1/baton/write", body);
  }
}
