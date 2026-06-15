import { z } from "zod";

export const MemoryType = z.enum([
  "fact", "preference", "constraint", "lesson", "risk",
]);

export const SourceType = z.enum(["human", "agent", "system", "document"]);

export const SourceTier = z.enum([
  "raw_source", "llm_derived", "human_confirmed",
]);

export const RecordStatus = z.enum([
  "active", "superseded", "revoked", "expired",
]);

export const TrustProofSchema = z.object({
  tier: SourceTier,
  confirmed_by: z.string(),
  confirmed_at: z.string(),
  evidence_ids: z.array(z.string()),
  method: z.enum(["human_review", "peer_consensus", "automated_check", "cross_reference"]),
}).strict();

export const ProvenanceTransitionSchema = z.object({
  type: z.enum(["transfer", "supersede", "tier_upgrade"]),
  from_memory_id: z.string(),
  to_memory_id: z.string(),
  performed_by: z.string(),
  performed_at: z.string(),
  tier_before: SourceTier,
  tier_after: SourceTier,
}).strict();

export const ProvenanceChainSchema = z.object({
  origin: z.object({
    memory_id: z.string(),
    agent_id: z.string(),
    namespace: z.string(),
    tier: SourceTier,
    created_at: z.string(),
  }),
  transitions: z.array(ProvenanceTransitionSchema),
}).strict();

export const AmhRecordSchema = z.object({
  amh_version: z.literal("0.1"),
  memory_id: z.string(),
  version: z.number().int().positive().optional(),
  status: RecordStatus,
  agent_id: z.string(),
  namespace: z.string(),
  memory_type: MemoryType,
  content: z.object({
    format: z.string(),
    value: z.string(),
  }),
  source: z.object({
    type: SourceType,
    ref: z.string(),
    tier: SourceTier,
  }),
  created_at: z.string(),
  created_by: z.string(),
  valid_until: z.string().optional(),
  supersedes: z.string().optional(),
  content_hash: z.string().optional(),
  trust_proof: TrustProofSchema.optional().nullable(),
  provenance_chain: ProvenanceChainSchema.optional().nullable(),
});

export type AmhRecord = z.infer<typeof AmhRecordSchema>;
export type TrustProof = z.infer<typeof TrustProofSchema>;
export type ProvenanceChain = z.infer<typeof ProvenanceChainSchema>;
export type MemoryType = z.infer<typeof MemoryType>;
export type SourceTier = z.infer<typeof SourceTier>;
export type RecordStatus = z.infer<typeof RecordStatus>;

export type AuditOperation = "write" | "read" | "transfer" | "supersede" | "revoke" | "tier_upgrade" | "expire" | "rejected";

export interface AuditEvent {
  event_id: string;
  memory_id: string;
  operation: AuditOperation;
  principal_id: string;
  timestamp: string;
  correlation_id?: string;
  details?: string;
}

export interface AmhQuery {
  memory_id?: string;
  namespace?: string;
  memory_type?: MemoryType;
  agent_id?: string;
  status?: RecordStatus;
  text?: string;
  limit?: number;
}
