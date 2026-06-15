import { z } from "zod";

export const MemoryType = z.enum([
  "decision", "fact", "preference", "constraint", "lesson", "risk",
]);

export const SourceType = z.enum(["human", "agent", "system", "document"]);

export const SourceTier = z.enum([
  "raw_source", "llm_derived", "human_confirmed",
]);

export const RecordStatus = z.enum([
  "active", "superseded", "revoked", "expired",
]);

export const AmhRecordSchema = z.object({
  amh_version: z.literal("0.1"),
  memory_id: z.string(),
  version: z.number().int().positive(),
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
});

export type AmhRecord = z.infer<typeof AmhRecordSchema>;
export type MemoryType = z.infer<typeof MemoryType>;
export type SourceTier = z.infer<typeof SourceTier>;
export type RecordStatus = z.infer<typeof RecordStatus>;

export interface AuditEvent {
  event_id: string;
  memory_id: string;
  operation: "write" | "read" | "transfer" | "supersede" | "revoke";
  agent_id: string;
  timestamp: string;
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
