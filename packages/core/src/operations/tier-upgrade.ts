import { randomUUID } from "node:crypto";
import type { AmhStore } from "../store/interface.js";
import { TrustProofSchema } from "../schema/types.js";
import type { TrustProof, SourceTier } from "../schema/types.js";
import { readMemory } from "./read.js";

const TIER_ORDER: Record<string, number> = {
  raw_source: 0,
  llm_derived: 1,
  human_confirmed: 2,
};

export class TierDowngradeError extends Error {
  constructor(public currentTier: string, public requestedTier: string) {
    super(`Tier downgrade forbidden: ${currentTier} → ${requestedTier}`);
    this.name = "TierDowngradeError";
  }
}

export class InvalidTrustProofError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTrustProofError";
  }
}

export interface TierUpgradeResult {
  memory_id: string;
  old_tier: SourceTier;
  new_tier: SourceTier;
}

export async function tierUpgrade(
  memoryId: string,
  newTier: SourceTier,
  trustProof: TrustProof,
  store: AmhStore,
  readContext?: { callerNamespace?: string },
): Promise<TierUpgradeResult> {
  const record = await readMemory(memoryId, store, {
    ...readContext,
    filterExpired: false,
  });

  if (!record) {
    throw new Error(`Memory not found: ${memoryId}`);
  }
  if (record.status !== "active") {
    throw new Error(`Cannot upgrade tier of non-active record: ${record.status}`);
  }

  const oldTier = record.source.tier;
  const oldOrder = TIER_ORDER[oldTier] ?? -1;
  const newOrder = TIER_ORDER[newTier] ?? -1;

  if (newOrder <= oldOrder) {
    throw new TierDowngradeError(oldTier, newTier);
  }

  const parsed = TrustProofSchema.safeParse(trustProof);
  if (!parsed.success) {
    throw new InvalidTrustProofError(`Invalid TrustProof: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
  }

  if (newTier === "human_confirmed" && parsed.data.tier !== "human_confirmed") {
    throw new InvalidTrustProofError("TrustProof tier must match requested tier for human_confirmed upgrade");
  }

  const proof = parsed.data;

  if (store.patchTier) {
    await store.patchTier(memoryId, newTier, proof);
  } else if (store.patchMetadata) {
    await store.patchMetadata(memoryId, {
      source_tier: newTier,
      trust_proof: JSON.stringify(proof),
    });
  } else {
    throw new Error("Store does not support tier upgrade (missing patchTier or patchMetadata)");
  }

  const now = new Date().toISOString();

  await store.appendAudit({
    event_id: randomUUID(),
    memory_id: memoryId,
    operation: "tier_upgrade",
    principal_id: proof.confirmed_by,
    timestamp: now,
    details: `${oldTier} → ${newTier}`,
  });

  return { memory_id: memoryId, old_tier: oldTier, new_tier: newTier };
}
