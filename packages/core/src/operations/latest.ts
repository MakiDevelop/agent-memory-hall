import type { AmhQuery, AmhRecord } from "../schema/types.js";
import type { AmhStore } from "../store/interface.js";
import { queryMemories, type ReadContext } from "./read.js";
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

  // 所有 store 一律走 queryMemories，不再為 memhall 開特例分支。
  //
  // 舊版對 MemhallStore 直接呼叫 store.listLatest()，因此繞過了 queryMemories 的
  // 三層治理：requireTrustedCaller()、enforceNamespaceIsolation()、
  // applyLifecycleFilter()。實測後果：
  //   - superseded / revoked 的記錄仍被 boot 當成現況，把已作廢的 blocker 與
  //     artifact 帶回接班視窗
  //   - namespaceIsolation 開啟但沒有 caller namespace 時不會 fail-closed
  //   - 跨 namespace 是靜默濾除而非拋 NamespaceViolationError
  //
  // MemhallStore.query() 在沒有 text 時本來就走 chronological listLatest()，
  // 不會誤走 hybrid search，所以 latest / search 的分流設計不受影響。
  // （Codex review 2026-08-10 發現 #2）
  const filter: AmhQuery = {
    namespace: options.namespace,
    memory_type: options.memory_type,
    agent_id: options.agent_id,
    limit: Math.max(limit, prefer ? 20 : limit),
  };
  let records = await queryMemories(filter, store, context);

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
