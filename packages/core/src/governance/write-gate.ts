import type { AmhRecord } from "../schema/types.js";
import type { AmhStore } from "../store/interface.js";
import { checkSourceTier } from "./source-tier.js";
import { checkDedup, computeContentHash } from "./dedup.js";
import { NamespaceViolationError } from "./namespace.js";
import { requireTrustedCaller } from "./caller.js";

export interface WriteGateConfig {
  dedup: boolean;
  antiOuroboros: boolean;
  namespaceIsolation: boolean;
  writeGate: boolean;
}

const DEFAULT_CONFIG: WriteGateConfig = {
  dedup: true,
  antiOuroboros: true,
  namespaceIsolation: true,
  writeGate: true,
};

export interface WriteGateContext {
  callerNamespace?: string;
}

export interface WriteGateResult {
  record: AmhRecord;
  governanceApplied: string[];
}

export async function runWriteGate(
  record: AmhRecord,
  store: AmhStore,
  config: Partial<WriteGateConfig> = {},
  context: WriteGateContext = {}
): Promise<WriteGateResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const governanceApplied: string[] = [];

  if (!cfg.writeGate) {
    return { record, governanceApplied };
  }

  if (cfg.namespaceIsolation) {
    requireTrustedCaller(true, context.callerNamespace);
    if (record.namespace !== context.callerNamespace) {
      throw new NamespaceViolationError(context.callerNamespace!, record.namespace);
    }
    governanceApplied.push("namespace_isolation");
  }

  if (cfg.antiOuroboros) {
    await checkSourceTier(record, store, {
      callerNamespace: context.callerNamespace,
      namespaceIsolation: cfg.namespaceIsolation,
    });
    governanceApplied.push("anti_ouroboros");
  }

  record.content_hash = computeContentHash(record.content.format, record.content.value);
  governanceApplied.push("content_hash");

  if (cfg.dedup) {
    await checkDedup(record, store);
    governanceApplied.push("dedup");
  }

  return { record, governanceApplied };
}