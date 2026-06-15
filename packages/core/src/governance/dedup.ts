import { createHash } from "node:crypto";
import type { AmhRecord } from "../schema/types.js";
import type { AmhStore } from "../store/interface.js";

export class DuplicateMemoryError extends Error {
  constructor(public existingId: string) {
    super(`Duplicate memory detected: content matches existing record ${existingId}`);
    this.name = "DuplicateMemoryError";
  }
}

export function computeContentHash(value: string): string {
  return createHash("sha256").update(value, "utf-8").digest("hex");
}

export async function checkDedup(
  record: AmhRecord,
  store: AmhStore
): Promise<void> {
  const hash = computeContentHash(record.content.value);
  const existing = await store.query({ namespace: record.namespace });
  const dup = existing.find(
    (r) =>
      r.content_hash === hash &&
      r.memory_id !== record.memory_id &&
      r.status === "active"
  );
  if (dup) {
    throw new DuplicateMemoryError(dup.memory_id);
  }
}
