import type { AmhRecord, ProvenanceChain, SourceTier } from "../schema/types.js";

export function provenanceOrigin(record: AmhRecord): ProvenanceChain["origin"] {
  return {
    memory_id: record.memory_id,
    agent_id: record.agent_id,
    namespace: record.namespace,
    tier: record.source.tier,
    created_at: record.created_at,
  };
}

export function provenanceChain(record: AmhRecord): ProvenanceChain {
  return record.provenance_chain ?? {
    origin: provenanceOrigin(record),
    transitions: [],
  };
}

export function appendProvenanceTransition(
  record: AmhRecord,
  transition: {
    type: "transfer" | "supersede" | "tier_upgrade";
    from_memory_id: string;
    to_memory_id: string;
    performed_by: string;
    performed_at: string;
    tier_before: SourceTier;
    tier_after: SourceTier;
  },
): ProvenanceChain {
  const chain = provenanceChain(record);
  return {
    origin: chain.origin,
    transitions: [...chain.transitions, transition],
  };
}
