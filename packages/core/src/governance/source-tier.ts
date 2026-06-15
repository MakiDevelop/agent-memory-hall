import type { AmhRecord } from "../schema/types.js";
import type { AmhStore } from "../store/interface.js";
import { readMemory, type ReadContext } from "../operations/read.js";

export class AntiOuroborosError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AntiOuroborosError";
  }
}

export async function checkSourceTier(
  record: AmhRecord,
  store: AmhStore,
  readContext: ReadContext = {}
): Promise<void> {
  if (!record.supersedes) return;

  const parent = await readMemory(record.supersedes, store, {
    ...readContext,
    filterExpired: false,
  });
  if (!parent) return;

  if (
    parent.source.tier === "llm_derived" &&
    record.source.tier === "llm_derived"
  ) {
    throw new AntiOuroborosError(
      `Anti-Ouroboros: cannot create llm_derived memory that supersedes another llm_derived memory (${record.supersedes}). ` +
        `LLM-derived memories must not feed back into themselves.`
    );
  }
}
