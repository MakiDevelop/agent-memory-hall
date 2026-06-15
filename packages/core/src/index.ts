export { AmhRecordSchema, MemoryType, SourceType, SourceTier, RecordStatus, TrustProofSchema, ProvenanceChainSchema } from "./schema/types.js";
export type { AmhRecord, AuditEvent, AmhQuery, TrustProof, ProvenanceChain, AuditOperation } from "./schema/types.js";
export { validateAmhRecord, isValidAmhRecord } from "./schema/validate.js";
export type { AmhStore } from "./store/interface.js";
export { JsonFileStore } from "./store/json-file.js";
export { SqliteStore } from "./store/sqlite.js";
export { PostgresStore } from "./store/postgres.js";
export { MemhallStore } from "./store/memhall.js";
export { createStore, storeOptionsFromConfig } from "./store/factory.js";
export type { StoreOptions } from "./store/factory.js";
export { writeMemory } from "./operations/write.js";
export type { WriteInput, WriteResult } from "./operations/write.js";
export { readMemory, queryMemories } from "./operations/read.js";
export type { ReadContext } from "./operations/read.js";
export { transferMemory } from "./operations/transfer.js";
export type { TransferInput, TransferResult } from "./operations/transfer.js";
export { revokeMemory } from "./operations/revoke.js";
export type { RevokeInput, RevokeResult } from "./operations/revoke.js";
export { expireMemory } from "./operations/expire.js";
export type { ExpireInput, ExpireResult } from "./operations/expire.js";
export { getAuditLog } from "./operations/audit.js";
export { tierUpgrade, TierDowngradeError, InvalidTrustProofError } from "./operations/tier-upgrade.js";
export type { TierUpgradeIdentityContext, TierUpgradeResult } from "./operations/tier-upgrade.js";
export * from "./identity/index.js";
export { createAmhServer, createAmhContext, startServer } from "./mcp/server.js";
export type { ServerOptions, AmhServerContext } from "./mcp/server.js";
export { registerAmhResources } from "./mcp/resources.js";
export { convertUmpToAmh, convertAmhToUmp, importUmpFile, exportUmpFile } from "./import/ump.js";
export { convertMem0ToAmh, importMem0File } from "./import/mem0.js";
export {
  loadConfig,
  resolveIdentityConfig,
  resolveGovernance,
  defaultConfigPath,
  ConfigLoadError,
} from "./config.js";
export type { AmhConfig, ResolvedGovernance, ResolvedIdentityConfig } from "./config.js";
export { computeContentHash } from "./governance/dedup.js";
export { applyLifecycleFilter, isExpired, isInactive } from "./governance/lifecycle.js";
export { enforceNamespaceIsolation, NamespaceViolationError } from "./governance/namespace.js";
export { AMH_VERSION } from "./version.js";
