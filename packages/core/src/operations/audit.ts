import type { AuditEvent } from "../schema/types.js";
import type { AmhStore } from "../store/interface.js";

export async function getAuditLog(
  memoryId: string,
  store: AmhStore
): Promise<AuditEvent[]> {
  return store.getAudit(memoryId);
}
