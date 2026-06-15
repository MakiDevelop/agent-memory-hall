import { AmhRecordSchema, type AmhRecord } from "./types.js";

export function validateAmhRecord(record: unknown): AmhRecord {
  return AmhRecordSchema.parse(record);
}

export function isValidAmhRecord(record: unknown): record is AmhRecord {
  return AmhRecordSchema.safeParse(record).success;
}