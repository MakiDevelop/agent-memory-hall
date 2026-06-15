import { blake3 } from "@noble/hashes/blake3";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import type { AmhRecord } from "../schema/types.js";
import type { AmhStore } from "../store/interface.js";

export class DuplicateMemoryError extends Error {
  constructor(public existingId: string) {
    super(`Duplicate memory detected: content matches existing record ${existingId}`);
    this.name = "DuplicateMemoryError";
  }
}

export function computeContentHash(format: string, value: string): string {
  return bytesToHex(blake3(utf8ToBytes(`${format}:${value}`)));
}

export async function checkDedup(
  record: AmhRecord,
  store: AmhStore
): Promise<void> {
  const hash = computeContentHash(record.content.format, record.content.value);
  const dup = await store.findByContentHash(record.namespace, hash);
  if (dup && dup.memory_id !== record.memory_id && dup.status === "active") {
    throw new DuplicateMemoryError(dup.memory_id);
  }
}