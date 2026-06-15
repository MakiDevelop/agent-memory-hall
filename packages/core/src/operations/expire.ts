import { randomUUID } from "node:crypto";
import type { AuditEvent, RecordStatus } from "../schema/types.js";
import type { AmhStore } from "../store/interface.js";
import type { WriteGateConfig, WriteGateContext } from "../governance/write-gate.js";
import { requireTrustedCaller } from "../governance/caller.js";
import { readMemory } from "./read.js";

export interface ExpireInput {
  memory_id: string;
  expired_by: string;
  reason?: string;
}

export interface ExpireResult {
  memory_id: string;
  status: "expired";
  previous_status: RecordStatus;
  already_expired: boolean;
}

export async function expireMemory(
  input: ExpireInput,
  store: AmhStore,
  gateConfig?: Partial<WriteGateConfig>,
  gateContext?: WriteGateContext
): Promise<ExpireResult> {
  const namespaceIsolation = gateConfig?.namespaceIsolation ?? true;
  requireTrustedCaller(namespaceIsolation, gateContext?.callerNamespace);

  const record = await readMemory(input.memory_id, store, {
    callerNamespace: gateContext?.callerNamespace,
    namespaceIsolation: gateConfig?.namespaceIsolation ?? true,
    filterInactive: false,
  });
  if (!record) {
    throw new Error(`Memory not found: ${input.memory_id}`);
  }

  const previousStatus = record.status;
  if (record.status === "expired") {
    return {
      memory_id: input.memory_id,
      status: "expired",
      previous_status: previousStatus,
      already_expired: true,
    };
  }
  if (record.status !== "active") {
    throw new Error(`Cannot expire non-active record: ${record.status}`);
  }

  const now = new Date().toISOString();
  record.status = "expired";
  if (store.patchMetadata) {
    await store.patchMetadata(input.memory_id, {
      amh_status: "expired",
      amh_version: record.amh_version,
      expired_by: input.expired_by,
      expired_reason: input.reason ?? "Memory expired",
    });
  } else {
    await store.put(record);
  }

  const auditEvent: AuditEvent = {
    event_id: randomUUID(),
    memory_id: input.memory_id,
    operation: "expire",
    principal_id: input.expired_by,
    timestamp: now,
    details: input.reason ?? "Memory expired",
  };
  await store.appendAudit(auditEvent);

  return {
    memory_id: input.memory_id,
    status: "expired",
    previous_status: previousStatus,
    already_expired: false,
  };
}
