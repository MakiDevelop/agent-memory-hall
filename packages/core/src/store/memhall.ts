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

const VALID_STATUS = new Set<AmhRecord["status"]>(["active", "superseded", "revoked", "expired"]);

function amhStatusFromMeta(meta: Record<string, unknown>): AmhRecord["status"] {
  const status = meta.amh_status;
  return typeof status === "string" && VALID_STATUS.has(status as AmhRecord["status"])
    ? (status as AmhRecord["status"])
    : "active";
}

function entryToAmh(entry: MemhallEntry): AmhRecord {
  const meta = entry.metadata ?? {};
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
  };
}

function mapType(memhallType: string): AmhRecord["memory_type"] {
  const mapping: Record<string, AmhRecord["memory_type"]> = {
    episode: "lesson",
    decision: "decision",
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
    amh_content_hash: computeContentHash(record.content.value),
  };
}

function defaultAuditPath(baseUrl: string): string {
  const hash = createHash("sha256").update(baseUrl).digest("hex").slice(0, 16);
  return join(homedir(), ".amh", `memhall-audit-${hash}.json`);
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
    try {
      const raw = await readFile(this.auditPath, "utf-8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as AuditEvent[]) : [];
    } catch {
      return [];
    }
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
      throw new Error(`memhall ${method} ${path} failed: ${res.status} ${text}`);
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

  async query(filter: AmhQuery): Promise<AmhRecord[]> {
    const searchBody: Record<string, unknown> = {
      mode: "hybrid",
      limit: filter.limit ?? 20,
    };

    if (filter.text) {
      searchBody.query = filter.text;
    } else if (filter.namespace) {
      searchBody.query = filter.namespace;
    } else {
      searchBody.query = "*";
    }

    if (filter.namespace) {
      searchBody.namespace = filter.namespace;
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
    return this.query({ namespace, limit: 100 });
  }

  async appendAudit(event: AuditEvent): Promise<void> {
    await withFileLock(this.auditPath, async () => {
      const events = await this.readAuditFile();
      events.push(event);
      const { writeFile } = await import("node:fs/promises");
      await mkdir(dirname(this.auditPath), { recursive: true });
      await writeFile(this.auditPath, JSON.stringify(events, null, 2), "utf-8");
    });
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
    const all = await this.query({ limit: 500 });
    return all.length;
  }

  async namespaces(): Promise<string[]> {
    const results = await this.query({ limit: 500 });
    return [...new Set(results.map((r) => r.namespace))];
  }
}