import type { AmhRecord, AmhQuery } from "../schema/types.js";
import type { AmhStore } from "../store/interface.js";

export async function readMemory(
  memoryId: string,
  store: AmhStore
): Promise<AmhRecord | null> {
  return store.get(memoryId);
}

export async function queryMemories(
  filter: AmhQuery,
  store: AmhStore
): Promise<AmhRecord[]> {
  return store.query(filter);
}
