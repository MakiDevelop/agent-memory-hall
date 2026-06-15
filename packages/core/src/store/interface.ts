import type { AmhRecord, AuditEvent, AmhQuery, TrustProof, SourceTier } from "../schema/types.js";

export interface AmhStore {
  put(record: AmhRecord): Promise<void>;
  /** Optional: metadata-only updates (memhall PATCH). Used for revoke/supersede. */
  patchMetadata?(memoryId: string, metadata: Record<string, unknown>): Promise<void>;
  /** Optional: tier upgrade with trust proof. */
  patchTier?(memoryId: string, newTier: SourceTier, trustProof: TrustProof): Promise<void>;
  /** Optional: graph edge child → parent (memhall POST …/link). */
  linkSupersedes?(childId: string, parentId: string): Promise<void>;
  get(memoryId: string): Promise<AmhRecord | null>;
  query(filter: AmhQuery): Promise<AmhRecord[]>;
  findByContentHash(namespace: string, contentHash: string): Promise<AmhRecord | null>;
  delete(memoryId: string): Promise<boolean>;
  list(namespace?: string): Promise<AmhRecord[]>;
  appendAudit(event: AuditEvent): Promise<void>;
  getAudit(memoryId: string): Promise<AuditEvent[]>;
  count(): Promise<number>;
  namespaces(): Promise<string[]>;
}
