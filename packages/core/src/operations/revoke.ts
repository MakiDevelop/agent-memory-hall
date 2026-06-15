import { randomUUID } from "node:crypto";
import type { AuditEvent, RecordStatus } from "../schema/types.js";
import type { AmhStore } from "../store/interface.js";
import type { WriteGateConfig, WriteGateContext } from "../governance/write-gate.js";
import { requireTrustedCaller } from "../governance/caller.js";
import { readMemory } from "./read.js";

export interface RevokeInput {
  memory_id: string;
  revoked_by: string;
  reason?: string;
}

export interface RevokeResult {
  memory_id: string;
  status: "revoked";
  previous_status: RecordStatus;
  already_revoked: boolean;
}

export async function revokeMemory(
  input: RevokeInput,
  store: AmhStore,
  gateConfig?: Partial<WriteGateConfig>,
  gateContext?: WriteGateContext
): Promise<RevokeResult> {
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
  if (record.status === "revoked") {
    return {
      memory_id: input.memory_id,
      status: "revoked",
      previous_status: previousStatus,
      already_revoked: true,
    };
  }

  const now = new Date().toISOString();
  record.status = "revoked";
  await store.put(record);

  const auditEvent: AuditEvent = {
    event_id: randomUUID(),
    memory_id: input.memory_id,
    operation: "revoke",
    agent_id: input.revoked_by,
    timestamp: now,
    details: input.reason ?? "Memory revoked",
  };
  await store.appendAudit(auditEvent);

  return {
    memory_id: input.memory_id,
    status: "revoked",
    previous_status: previousStatus,
    already_revoked: false,
  };
}