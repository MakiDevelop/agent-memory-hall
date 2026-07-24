import type { AmhStore } from "../store/interface.js";
import type { AmhRecord } from "../schema/types.js";
import { isExpired } from "../governance/lifecycle.js";
import { expireMemory } from "./expire.js";
import type { WriteGateConfig, WriteGateContext } from "../governance/write-gate.js";

export interface TtlSweepOptions {
  namespace?: string;
  dryRun?: boolean;
  limit?: number;
  expired_by?: string;
}

export interface TtlSweepResult {
  scanned: number;
  due: number;
  expired: number;
  dry_run: boolean;
  due_ids: string[];
  errors: string[];
}

async function collectCandidates(
  store: AmhStore,
  namespace: string | undefined,
  limit: number
): Promise<AmhRecord[]> {
  if (namespace) {
    const listed = await store.list(namespace);
    return listed.slice(0, limit);
  }
  // Prefer namespaces() then list each (bounded)
  const nss = await store.namespaces();
  const out: AmhRecord[] = [];
  for (const ns of nss.slice(0, 50)) {
    const batch = await store.list(ns);
    out.push(...batch);
    if (out.length >= limit) break;
  }
  if (out.length === 0) {
    // fallback query
    return store.query({ limit });
  }
  return out.slice(0, limit);
}

/**
 * Expire records past valid_until (status still active).
 * Idempotent; safe dry-run.
 */
export async function ttlSweep(
  store: AmhStore,
  options: TtlSweepOptions = {},
  gateConfig?: Partial<WriteGateConfig>,
  gateContext?: WriteGateContext
): Promise<TtlSweepResult> {
  // default dry-run; pass dryRun: false (CLI --apply) to mutate
  const dry = options.dryRun !== false;

  const limit = options.limit ?? 500;
  const candidates = await collectCandidates(store, options.namespace, limit);
  const now = new Date();
  const due = candidates.filter(
    (r) => r.status === "active" && r.valid_until && isExpired(r, now)
  );

  const errors: string[] = [];
  let expired = 0;
  if (!dry) {
    for (const r of due) {
      try {
        await expireMemory(
          {
            memory_id: r.memory_id,
            expired_by: options.expired_by ?? "ttl-sweep",
            reason: `valid_until ${r.valid_until} passed`,
          },
          store,
          { ...gateConfig, namespaceIsolation: false },
          gateContext
        );
        expired++;
      } catch (err) {
        errors.push(
          `${r.memory_id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  return {
    scanned: candidates.length,
    due: due.length,
    expired: dry ? 0 : expired,
    dry_run: dry,
    due_ids: due.map((r) => r.memory_id),
    errors,
  };
}
