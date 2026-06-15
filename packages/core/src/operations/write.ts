import { randomUUID } from "node:crypto";
import { AmhRecordSchema, type AmhRecord, type AuditEvent } from "../schema/types.js";
import type { AmhStore } from "../store/interface.js";
import { runWriteGate, type WriteGateConfig } from "../governance/write-gate.js";

export interface WriteInput {
  agent_id: string;
  namespace: string;
  memory_type: AmhRecord["memory_type"];
  content: string;
  content_format?: string;
  source_type: AmhRecord["source"]["type"];
  source_ref: string;
  source_tier: AmhRecord["source"]["tier"];
  valid_until?: string;
  supersedes?: string;
}

export interface WriteResult {
  memory_id: string;
  version: number;
}

export async function writeMemory(
  input: WriteInput,
  store: AmhStore,
  gateConfig?: Partial<WriteGateConfig>
): Promise<WriteResult> {
  const memoryId = randomUUID();
  const now = new Date().toISOString();

  let record: AmhRecord = {
    amh_version: "0.1",
    memory_id: memoryId,
    version: 1,
    status: "active",
    agent_id: input.agent_id,
    namespace: input.namespace,
    memory_type: input.memory_type,
    content: {
      format: input.content_format ?? "text/plain",
      value: input.content,
    },
    source: {
      type: input.source_type,
      ref: input.source_ref,
      tier: input.source_tier,
    },
    created_at: now,
    created_by: input.agent_id,
    valid_until: input.valid_until,
    supersedes: input.supersedes,
  };

  AmhRecordSchema.parse(record);

  record = await runWriteGate(record, store, gateConfig);

  if (input.supersedes) {
    const parent = await store.get(input.supersedes);
    if (parent) {
      parent.status = "superseded";
      await store.put(parent);
    }
  }

  await store.put(record);

  const auditEvent: AuditEvent = {
    event_id: randomUUID(),
    memory_id: memoryId,
    operation: "write",
    agent_id: input.agent_id,
    timestamp: now,
    details: `Created ${input.memory_type} in ${input.namespace}`,
  };
  await store.appendAudit(auditEvent);

  return { memory_id: memoryId, version: 1 };
}
