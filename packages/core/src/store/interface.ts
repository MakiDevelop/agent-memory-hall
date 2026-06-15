import type { AmhRecord, AuditEvent, AmhQuery } from "../schema/types.js";

export interface AmhStore {
  put(record: AmhRecord): Promise<void>;
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
