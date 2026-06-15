import type { AmhRecord } from "../schema/types.js";

export function isExpired(record: AmhRecord, now = new Date()): boolean {
  if (record.status === "expired") return true;
  if (!record.valid_until) return false;
  return new Date(record.valid_until) < now;
}

export function applyLifecycleFilter(records: AmhRecord[]): AmhRecord[] {
  const now = new Date();
  return records.filter((r) => !isExpired(r, now));
}