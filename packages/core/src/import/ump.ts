import { randomUUID } from "node:crypto";
import type { AmhRecord } from "../schema/types.js";

interface UmpRecord {
  id?: string;
  kind?: string;
  body?: string;
  scope?: {
    owner?: string;
    namespace?: string;
    visibility?: string;
  };
  provenance?: {
    actor?: string;
    actor_kind?: string;
    method?: string;
    source?: string | { provider?: string };
    evidence?: string;
  };
  created?: string;
  valid_from?: string;
  valid_to?: string;
  status?: string;
  confidence?: number;
  supersedes?: string;
  [key: string]: unknown;
}

const KIND_TO_TYPE: Record<string, AmhRecord["memory_type"]> = {
  semantic: "fact",
  episodic: "lesson",
  procedural: "constraint",
  working: "fact",
  identity: "preference",
};

const ACTOR_KIND_TO_SOURCE: Record<string, AmhRecord["source"]["type"]> = {
  human: "human",
  agent: "agent",
  import: "system",
};

function mapSourceTier(umpRecord: UmpRecord): AmhRecord["source"]["tier"] {
  if (umpRecord.provenance?.actor_kind === "human") return "human_confirmed";
  if (umpRecord.provenance?.actor_kind === "import") return "raw_source";
  return "llm_derived";
}

export function convertUmpToAmh(ump: UmpRecord): AmhRecord {
  return {
    amh_version: "0.1",
    memory_id: ump.id?.replace("urn:ump:", "") ?? randomUUID(),
    version: 1,
    status: ump.status === "tombstoned" ? "revoked" : "active",
    agent_id: ump.scope?.owner ?? ump.provenance?.actor ?? "unknown",
    namespace: ump.scope?.namespace ?? "imported",
    memory_type: KIND_TO_TYPE[ump.kind ?? "semantic"] ?? "fact",
    content: {
      format: "text/markdown",
      value: ump.body ?? "",
    },
    source: {
      type: ACTOR_KIND_TO_SOURCE[ump.provenance?.actor_kind ?? "agent"] ?? "agent",
      ref: typeof ump.provenance?.source === "string"
        ? ump.provenance.source
        : ump.provenance?.source?.provider ?? "ump-import",
      tier: mapSourceTier(ump),
    },
    created_at: ump.created ?? ump.valid_from ?? new Date().toISOString(),
    created_by: ump.provenance?.actor ?? "ump-import",
    valid_until: ump.valid_to,
    supersedes: ump.supersedes?.replace("urn:ump:", ""),
  };
}

export function convertAmhToUmp(amh: AmhRecord): UmpRecord {
  const TYPE_TO_KIND: Record<string, string> = {
    fact: "semantic",
    lesson: "episodic",
    constraint: "procedural",
    preference: "identity",
    decision: "semantic",
    risk: "semantic",
  };

  return {
    id: `urn:ump:${amh.memory_id}`,
    kind: TYPE_TO_KIND[amh.memory_type] ?? "semantic",
    body: amh.content.value,
    scope: {
      owner: amh.agent_id,
      namespace: amh.namespace,
      visibility: "private",
    },
    provenance: {
      actor: amh.created_by,
      actor_kind: amh.source.type === "human" ? "human" : "agent",
      source: amh.source.ref,
    },
    created: amh.created_at,
    valid_from: amh.created_at,
    valid_to: amh.valid_until,
    status: amh.status === "revoked" ? "tombstoned" : "active",
    supersedes: amh.supersedes ? `urn:ump:${amh.supersedes}` : undefined,
  };
}

export async function importUmpFile(filePath: string): Promise<AmhRecord[]> {
  const { readFile } = await import("node:fs/promises");
  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw);

  const records: UmpRecord[] = Array.isArray(data) ? data : [data];
  return records.map(convertUmpToAmh);
}
