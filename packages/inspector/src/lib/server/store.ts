import { createStore } from "@chibakuma/agent-memory-hall";
import type { AmhStore } from "@chibakuma/agent-memory-hall";
import { env } from "$env/dynamic/private";

let _store: AmhStore | null = null;

export function getStore(): AmhStore | null {
  if (_store) return _store;

  const storeType = (env.AMH_STORE as "sqlite" | "json" | undefined) ?? undefined;
  const storePath = env.AMH_STORE_PATH ?? undefined;

  if (!storeType) return null;

  _store = createStore({ storeType, storePath });
  return _store;
}

export function isLiveMode(): boolean {
  return !!env.AMH_STORE;
}
