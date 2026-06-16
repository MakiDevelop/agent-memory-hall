export type LayerId = "L1" | "L2" | "L3" | "L4" | "L5";

export interface Layer {
  id: LayerId;
  name: string;
  description: string;
  tests: string[];
}

export const layers: Layer[] = [
  {
    id: "L1",
    name: "Memory Schema",
    description: "ACA Layer 1: Structured memory records with required fields",
    tests: [
      "memory_id is present and unique",
      "amh_version is '0.1'",
      "status is one of: active, superseded, revoked, expired",
      "memory_type is one of: fact, preference, constraint, lesson, risk",
      "source.type is one of: human, agent, system, document",
      "source.tier is one of: raw_source, llm_derived, human_confirmed",
      "content has format and value fields",
      "created_at is ISO 8601",
      "created_by is non-empty",
      "content_hash is present when available",
    ],
  },
  {
    id: "L2",
    name: "Governance Policies",
    description: "ACA Layer 2: Namespace isolation, lifecycle, dedup, write gates",
    tests: [
      "namespace isolation enforced (cross-namespace read blocked)",
      "content_hash dedup prevents duplicate writes",
      "supersede policy: old record status set to superseded",
      "lifecycle filter excludes expired records",
      "write gate rejects invalid records",
    ],
  },
  {
    id: "L3",
    name: "Trust & Provenance",
    description: "ACA Layer 3: Source tier, trust proof, provenance chain",
    tests: [
      "trust_proof present for human_confirmed records",
      "trust_proof.method is valid enum",
      "provenance_chain.origin references existing memory",
      "provenance_chain.transitions are chronologically ordered",
      "tier_upgrade requires trust_proof",
      "no ouroboros: llm_derived not fed back into derivation",
    ],
  },
  {
    id: "L4",
    name: "Audit Trail",
    description: "ACA Layer 4: Immutable audit events for all operations",
    tests: [
      "write operation generates audit event",
      "revoke operation generates audit event",
      "tier_upgrade operation generates audit event",
      "audit events are append-only (no deletion)",
      "audit event has correlation_id when applicable",
    ],
  },
  {
    id: "L5",
    name: "Decision Governance",
    description: "ACA Layer 5: Decision pipeline with authority, review, ratification",
    tests: [
      "decision has proposer with valid role",
      "high-risk decision requires independent review",
      "ratification records review addressal",
      "self-approval blocked (proposer != ratifier)",
      "authority check enforces capabilities and constraints",
      "escalation routes to correct target role",
    ],
  },
];
