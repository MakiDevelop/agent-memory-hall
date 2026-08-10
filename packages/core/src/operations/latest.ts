import type { AmhQuery, AmhRecord } from "../schema/types.js";
import type { AmhStore } from "../store/interface.js";
import { queryMemories, type ReadContext } from "./read.js";
import { MemhallStore } from "../store/memhall.js";
import { hasStateTag } from "../state-markers.js";

export interface LatestOptions {
  namespace: string;
  memory_type?: AmhRecord["memory_type"];
  agent_id?: string;
  limit?: number;
  /** Prefer entries whose content starts with [state / [wrap-up / [handoff (default true) */
  preferStateMarkers?: boolean;
}

/**
 * Load latest records by created_at DESC for a namespace.
 * On memhall backend uses GET list (not hybrid search).
 * On sqlite/json/postgres uses store.query (already time-ordered).
 */
export async function latestMemories(
  options: LatestOptions,
  store: AmhStore,
  context: ReadContext = {}
): Promise<AmhRecord[]> {
  const limit = options.limit ?? 5;
  const prefer = options.preferStateMarkers !== false;

  let records: AmhRecord[];
  if (store instanceof MemhallStore) {
    records = await store.listLatest({
      namespace: options.namespace,
      memory_type: options.memory_type,
      agent_id: options.agent_id,
      limit: Math.max(limit, prefer ? 20 : limit),
    });
    // Namespace isolation for memhall path
    if (context.namespaceIsolation && context.callerNamespace) {
      records = records.filter((r) => r.namespace === context.callerNamespace);
    }
  } else {
    const filter: AmhQuery = {
      namespace: options.namespace,
      memory_type: options.memory_type,
      agent_id: options.agent_id,
      limit: Math.max(limit, prefer ? 20 : limit),
    };
    records = await queryMemories(filter, store, context);
  }

  if (prefer) {
    const stateLike = records.filter((r) => isStateLike(r.content.value));
    if (stateLike.length > 0) {
      return stateLike.slice(0, limit);
    }
  }

  return records.slice(0, limit);
}

export function isStateLike(content: string): boolean {
  const head = content.trimStart().slice(0, 80).toLowerCase();
  return (
    // 標頭清單來自 ../state-markers.js，與 write-format 的 formatter 共用同一份
    hasStateTag(content) ||
    head.includes("status: open") ||
    head.includes("status:blocked") ||
    head.includes("status: blocked")
  );
}
