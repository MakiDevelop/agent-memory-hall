import { randomUUID } from "node:crypto";
import type { AmhRecord } from "../schema/types.js";

interface Mem0Memory {
  id?: string;
  memory?: string;
  user_id?: string;
  agent_id?: string;
  metadata?: {
    category?: string;
    [key: string]: unknown;
  };
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

function inferMemoryType(mem: Mem0Memory): AmhRecord["memory_type"] {
  const text = (mem.memory ?? "").toLowerCase();
  if (text.includes("decided") || text.includes("chose") || text.includes("decision")) return "fact";
  if (text.includes("prefers") || text.includes("likes") || text.includes("preference")) return "preference";
  if (text.includes("must") || text.includes("constraint") || text.includes("cannot")) return "constraint";
  if (text.includes("learned") || text.includes("lesson") || text.includes("mistake")) return "lesson";
  if (text.includes("risk") || text.includes("danger") || text.includes("warning")) return "risk";
  return "fact";
}

export function convertMem0ToAmh(mem: Mem0Memory): AmhRecord {
  return {
    amh_version: "0.1",
    memory_id: mem.id ?? randomUUID(),
    version: 1,
    status: "active",
    agent_id: mem.agent_id ?? mem.user_id ?? "unknown",
    namespace: "imported:mem0",
    memory_type: inferMemoryType(mem),
    content: {
      format: "text/plain",
      value: mem.memory ?? "",
    },
    source: {
      type: "system",
      ref: "mem0-import",
      tier: "llm_derived",
    },
    created_at: mem.created_at ?? new Date().toISOString(),
    created_by: "mem0-import",
  };
}

export async function importMem0File(filePath: string): Promise<AmhRecord[]> {
  const { readFile } = await import("node:fs/promises");
  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw);

  const memories: Mem0Memory[] = Array.isArray(data)
    ? data
    : data.results ?? data.memories ?? [data];

  return memories.map(convertMem0ToAmh);
}
