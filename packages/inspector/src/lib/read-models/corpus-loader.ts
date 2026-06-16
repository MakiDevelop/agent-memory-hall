import seedData from "../../../seed/governance-demo.json";

export interface CorpusMemory {
  memory_id: string;
  agent_id: string;
  namespace: string;
  memory_type: string;
  status: string;
  source: { type: string; ref: string; tier: string };
  content: { format: string; value: string };
  created_at: string;
  created_by: string;
  trust_proof?: {
    tier: string;
    confirmed_by: string;
    confirmed_at: string;
    evidence_ids: string[];
    method: string;
  } | null;
  provenance_chain?: {
    origin: { memory_id: string; agent_id: string; namespace: string; tier: string; created_at: string };
    transitions: Array<{
      type: string;
      from_memory_id: string;
      to_memory_id: string;
      performed_by: string;
      performed_at: string;
      tier_before: string;
      tier_after: string;
    }>;
  } | null;
  supersedes?: string;
  content_hash?: string;
}

export interface CorpusAuditEvent {
  event_id: string;
  memory_id: string;
  operation: string;
  principal_id: string;
  timestamp: string;
  details?: string;
  correlation_id?: string;
}

export interface Corpus {
  roles: Array<Record<string, unknown>>;
  assignments: Array<Record<string, unknown>>;
  memories: CorpusMemory[];
  decisions: Array<Record<string, unknown>>;
  audit_events: CorpusAuditEvent[];
}

let corpus: Corpus = seedData as unknown as Corpus;

export function getCorpus(): Corpus {
  return corpus;
}

export function getMemories(filters?: {
  namespace?: string;
  status?: string;
  memory_type?: string;
  agent_id?: string;
  tier?: string;
  q?: string;
}): CorpusMemory[] {
  let results = corpus.memories;

  if (filters?.namespace) {
    results = results.filter(m => m.namespace === filters.namespace);
  }
  if (filters?.status) {
    results = results.filter(m => m.status === filters.status);
  }
  if (filters?.memory_type) {
    results = results.filter(m => m.memory_type === filters.memory_type);
  }
  if (filters?.agent_id) {
    results = results.filter(m => m.agent_id === filters.agent_id);
  }
  if (filters?.tier) {
    results = results.filter(m => m.source.tier === filters.tier);
  }
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    results = results.filter(m =>
      m.content.value.toLowerCase().includes(q) ||
      m.memory_id.toLowerCase().includes(q),
    );
  }

  return results.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getMemory(id: string): CorpusMemory | undefined {
  return corpus.memories.find(m => m.memory_id === id);
}

export function getAuditEventsForMemory(memoryId: string): CorpusAuditEvent[] {
  return corpus.audit_events
    .filter(e => e.memory_id === memoryId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function getUniqueValues(field: "agent_id" | "namespace" | "memory_type" | "status"): string[] {
  return [...new Set(corpus.memories.map(m => m[field]))].sort();
}

export function getUniqueTiers(): string[] {
  return [...new Set(corpus.memories.map(m => m.source.tier))].sort();
}
