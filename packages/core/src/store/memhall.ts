import type { AmhStore } from "./interface.js";
import type { AmhRecord, AuditEvent, AmhQuery } from "../schema/types.js";

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
}

function entryToAmh(entry: MemhallEntry): AmhRecord {
  const meta = entry.metadata ?? {};
  return {
    amh_version: "0.1",
    memory_id: entry.entry_id,
    version: 1,
    status: "active",
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

export class MemhallStore implements AmhStore {
  private baseUrl: string;
  private token: string;
  private localAudit: AuditEvent[] = [];

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
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
    await this.api<MemhallWriteResponse>("POST", "/v1/memory/write", {
      agent_id: record.agent_id,
      namespace: record.namespace,
      type: reverseMapType(record.memory_type),
      content: record.content.value,
      tags: ["amh"],
      metadata: {
        amh_version: record.amh_version,
        source_type: record.source.type,
        source_ref: record.source.ref,
        source_tier: record.source.tier,
        valid_until: record.valid_until,
        supersedes: record.supersedes,
      },
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

    return records;
  }

  async delete(_memoryId: string): Promise<boolean> {
    throw new Error("MemhallStore does not support delete (governance: deletion requires memhall admin)");
  }

  async list(namespace?: string): Promise<AmhRecord[]> {
    return this.query({ namespace, limit: 100 });
  }

  async appendAudit(event: AuditEvent): Promise<void> {
    this.localAudit.push(event);
  }

  async getAudit(memoryId: string): Promise<AuditEvent[]> {
    return this.localAudit.filter((e) => e.memory_id === memoryId);
  }

  async count(): Promise<number> {
    const results = await this.query({ limit: 1 });
    return results.length;
  }

  async namespaces(): Promise<string[]> {
    const results = await this.query({ limit: 100 });
    return [...new Set(results.map((r) => r.namespace))];
  }
}
