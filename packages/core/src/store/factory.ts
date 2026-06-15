import { JsonFileStore } from "./json-file.js";
import { SqliteStore } from "./sqlite.js";
import { PostgresStore } from "./postgres.js";
import { MemhallStore } from "./memhall.js";
import type { AmhStore } from "./interface.js";
import type { AmhConfig } from "../config.js";

export interface StoreOptions {
  storeType?: "json" | "sqlite" | "postgres" | "memhall";
  storePath?: string;
  memhallToken?: string;
}

export function createStore(opts: StoreOptions = {}): AmhStore {
  const type = opts.storeType ?? "sqlite";
  if (type === "memhall") {
    if (!opts.storePath) {
      throw new Error("Memhall store requires --path with the memhall API URL");
    }
    const token = opts.memhallToken ?? process.env.MH_API_TOKEN ?? "";
    if (!token) {
      throw new Error("Memhall store requires MH_API_TOKEN env var or --token flag");
    }
    return new MemhallStore(opts.storePath, token);
  }
  if (type === "postgres") {
    if (!opts.storePath) {
      throw new Error(
        "Postgres store requires --path with a connection string (e.g. postgres://user:pass@localhost:5432/amh)"
      );
    }
    return new PostgresStore(opts.storePath);
  }
  if (type === "sqlite") {
    return new SqliteStore(opts.storePath);
  }
  return new JsonFileStore(opts.storePath);
}

export function storeOptionsFromConfig(config: AmhConfig, cli?: StoreOptions): StoreOptions {
  return {
    storeType: cli?.storeType ?? config.store,
    storePath: cli?.storePath ?? config.store_path,
    memhallToken: cli?.memhallToken ?? config.memhall_token,
  };
}