import type { AmhRecord } from "../schema/types.js";
import type { AmhStore } from "../store/interface.js";
import { checkSourceTier } from "./source-tier.js";
import { checkDedup, computeContentHash } from "./dedup.js";

export interface WriteGateConfig {
  dedup: boolean;
  antiOuroboros: boolean;
  namespaceIsolation: boolean;
}

const DEFAULT_CONFIG: WriteGateConfig = {
  dedup: true,
  antiOuroboros: true,
  namespaceIsolation: true,
};

export async function runWriteGate(
  record: AmhRecord,
  store: AmhStore,
  config: Partial<WriteGateConfig> = {}
): Promise<AmhRecord> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (cfg.antiOuroboros) {
    await checkSourceTier(record, store);
  }

  record.content_hash = computeContentHash(record.content.value);

  if (cfg.dedup) {
    await checkDedup(record, store);
  }

  return record;
}
