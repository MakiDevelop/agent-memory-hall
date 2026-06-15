import type { AmhRecord, AmhQuery } from "../schema/types.js";
import type { AmhStore } from "../store/interface.js";
import { enforceNamespaceIsolation } from "../governance/namespace.js";
import { applyLifecycleFilter } from "../governance/lifecycle.js";
import { requireTrustedCaller } from "../governance/caller.js";

export interface ReadContext {
  callerNamespace?: string;
  namespaceIsolation?: boolean;
  /** When false, expired / revoked / superseded records are hidden (default true). */
  filterInactive?: boolean;
  /** @deprecated Use filterInactive */
  filterExpired?: boolean;
}

export async function readMemory(
  memoryId: string,
  store: AmhStore,
  context: ReadContext = {}
): Promise<AmhRecord | null> {
  requireTrustedCaller(context.namespaceIsolation, context.callerNamespace);

  const record = await store.get(memoryId);
  if (!record) return null;

  if (context.namespaceIsolation) {
    if (record.namespace !== context.callerNamespace) {
      return null;
    }
  }

  const filterInactive = context.filterInactive ?? context.filterExpired ?? true;
  if (filterInactive) {
    const filtered = applyLifecycleFilter([record]);
    return filtered[0] ?? null;
  }

  return record;
}

export async function queryMemories(
  filter: AmhQuery,
  store: AmhStore,
  context: ReadContext = {}
): Promise<AmhRecord[]> {
  requireTrustedCaller(context.namespaceIsolation, context.callerNamespace);

  let scoped = filter;
  if (context.namespaceIsolation) {
    scoped = enforceNamespaceIsolation(context.callerNamespace, filter);
  }

  const results = await store.query(scoped);

  const filterInactive = context.filterInactive ?? context.filterExpired ?? true;
  if (filterInactive) {
    return applyLifecycleFilter(results);
  }

  return results;
}