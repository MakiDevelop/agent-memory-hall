import type { AmhRecord } from "../schema/types.js";
import type { AmhStore } from "../store/interface.js";
import { readMemory, type ReadContext } from "../operations/read.js";

/**
 * Retained for callers that still catch it. No longer thrown by checkSourceTier
 * since the 2026-08-01 council ratification (see LLM_TO_LLM_SUPERSEDE).
 */
export class AntiOuroborosError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AntiOuroborosError";
  }
}

/**
 * Governance marker emitted when an llm_derived memory supersedes another
 * llm_derived memory.
 *
 * Council 2026-08-01 (council-lite, ratified by Maki) relaxed this from a hard
 * block to mark-and-audit: the block had never fired in 33 days of production
 * traffic because tier was silently forced to human_confirmed on every
 * supersede, and restoring the block would have made agent-initiated supersede
 * impossible for the 99/121 records that are llm_derived.
 *
 * The relaxation is not a removal — every occurrence lands in governance_applied
 * and in the supersede audit event.
 */
export const LLM_TO_LLM_SUPERSEDE = "llm_to_llm_supersede";

/**
 * Inspect the source tier of a supersede against its parent.
 * Returns governance markers; does not throw.
 */
export async function checkSourceTier(
  record: AmhRecord,
  store: AmhStore,
  readContext: ReadContext = {}
): Promise<string[]> {
  if (!record.supersedes) return [];

  const parent = await readMemory(record.supersedes, store, {
    ...readContext,
    filterExpired: false,
  });
  if (!parent) return [];

  if (
    parent.source.tier === "llm_derived" &&
    record.source.tier === "llm_derived"
  ) {
    return [LLM_TO_LLM_SUPERSEDE];
  }

  return [];
}
