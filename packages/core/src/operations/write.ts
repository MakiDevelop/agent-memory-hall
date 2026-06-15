import { randomUUID } from "node:crypto";
import { AmhRecordSchema, type AmhRecord, type AuditEvent } from "../schema/types.js";
import type { AmhStore } from "../store/interface.js";
import { runWriteGate, type WriteGateConfig, type WriteGateContext } from "../governance/write-gate.js";
import { readMemory } from "./read.js";

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
  governance_applied: string[];
}

export async function writeMemory(
  input: WriteInput,
  store: AmhStore,
  gateConfig?: Partial<WriteGateConfig>,
  gateContext?: WriteGateContext
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

  const context: WriteGateContext = {
    ...gateContext,
    callerNamespace: gateContext?.callerNamespace,
  };

  const { record: gated, governanceApplied } = await runWriteGate(
    record,
    store,
    gateConfig,
    context
  );
  record = gated;

  if (input.supersedes) {
    const parent = await readMemory(input.supersedes, store, {
      callerNamespace: context.callerNamespace,
      namespaceIsolation: gateConfig?.namespaceIsolation ?? true,
      filterExpired: false,
    });
    if (!parent) {
      throw new Error(
        `Cannot supersede: parent memory not found or not accessible: ${input.supersedes}`
      );
    }
    parent.status = "superseded";
    if (store.patchMetadata) {
      await store.patchMetadata(input.supersedes, {
        amh_status: "superseded",
        amh_version: parent.amh_version,
      });
    } else {
      await store.put(parent);
    }
    const supersedeAudit: AuditEvent = {
      event_id: randomUUID(),
      memory_id: input.supersedes,
      operation: "supersede",
      agent_id: input.agent_id,
      timestamp: now,
      details: `Superseded by ${memoryId}`,
    };
    await store.appendAudit(supersedeAudit);
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

  return { memory_id: record.memory_id, version: 1, governance_applied: governanceApplied };
}