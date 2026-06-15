import { randomUUID } from "node:crypto";
import type { AmhRecord, AuditEvent } from "../schema/types.js";
import type { AmhStore } from "../store/interface.js";

export interface TransferInput {
  memory_id: string;
  target_namespace: string;
  target_agent: string;
  transferred_by: string;
}

export interface TransferResult {
  new_memory_id: string;
  source_memory_id: string;
}

export async function transferMemory(
  input: TransferInput,
  store: AmhStore
): Promise<TransferResult> {
  const source = await store.get(input.memory_id);
  if (!source) {
    throw new Error(`Memory not found: ${input.memory_id}`);
  }

  const newId = randomUUID();
  const now = new Date().toISOString();

  const transferred: AmhRecord = {
    ...source,
    memory_id: newId,
    version: 1,
    namespace: input.target_namespace,
    agent_id: input.target_agent,
    created_at: now,
    created_by: input.transferred_by,
    source: {
      type: "agent",
      ref: `transfer:${input.memory_id}`,
      tier: source.source.tier,
    },
  };

  await store.put(transferred);

  const auditEvent: AuditEvent = {
    event_id: randomUUID(),
    memory_id: newId,
    operation: "transfer",
    agent_id: input.transferred_by,
    timestamp: now,
    details: `Transferred from ${source.namespace}/${input.memory_id} to ${input.target_namespace}`,
  };
  await store.appendAudit(auditEvent);

  return { new_memory_id: newId, source_memory_id: input.memory_id };
}
