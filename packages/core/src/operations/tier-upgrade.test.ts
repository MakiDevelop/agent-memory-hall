import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tierUpgrade, TierDowngradeError, InvalidTrustProofError } from "./tier-upgrade.js";
import { writeMemory } from "./write.js";
import { readMemory } from "./read.js";
import { getAuditLog } from "./audit.js";
import { SqliteStore } from "../store/sqlite.js";
import { unlinkSync, existsSync } from "node:fs";
import type { TrustProof, SourceTier } from "../schema/types.js";

function makeTrustProof(tier: SourceTier, by = "maki"): TrustProof {
  return {
    tier,
    confirmed_by: by,
    confirmed_at: new Date().toISOString(),
    evidence_ids: ["ev-001"],
    method: "human_review",
  };
}

async function seedRecord(store: SqliteStore, tier: SourceTier = "raw_source"): Promise<string> {
  const result = await writeMemory(
    {
      agent_id: "planner",
      namespace: "project:test",
      memory_type: "fact",
      content: "test content",
      source_type: "agent",
      source_ref: "session:1",
      source_tier: tier,
    },
    store,
    { dedup: false, antiOuroboros: false, namespaceIsolation: false, writeGate: false },
    { callerNamespace: "project:test" },
  );
  return result.memory_id;
}

describe("tierUpgrade", () => {
  const dbPath = "/tmp/amh-tier-upgrade-test.db";

  function freshStore(): SqliteStore {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    return new SqliteStore(dbPath);
  }

  it("upgrades raw_source → llm_derived", async () => {
    const store = freshStore();
    const id = await seedRecord(store, "raw_source");
    const proof = makeTrustProof("llm_derived");

    const result = await tierUpgrade(id, "llm_derived", proof, store);

    assert.equal(result.old_tier, "raw_source");
    assert.equal(result.new_tier, "llm_derived");

    const record = await readMemory(id, store);
    assert.equal(record!.source.tier, "llm_derived");
  });

  it("upgrades raw_source → human_confirmed", async () => {
    const store = freshStore();
    const id = await seedRecord(store, "raw_source");
    const proof = makeTrustProof("human_confirmed");

    const result = await tierUpgrade(id, "human_confirmed", proof, store);

    assert.equal(result.old_tier, "raw_source");
    assert.equal(result.new_tier, "human_confirmed");
  });

  it("upgrades llm_derived → human_confirmed", async () => {
    const store = freshStore();
    const id = await seedRecord(store, "llm_derived");
    const proof = makeTrustProof("human_confirmed");

    const result = await tierUpgrade(id, "human_confirmed", proof, store);

    assert.equal(result.old_tier, "llm_derived");
    assert.equal(result.new_tier, "human_confirmed");
  });

  it("rejects downgrade human_confirmed → llm_derived", async () => {
    const store = freshStore();
    const id = await seedRecord(store, "raw_source");
    await tierUpgrade(id, "human_confirmed", makeTrustProof("human_confirmed"), store);

    await assert.rejects(
      () => tierUpgrade(id, "llm_derived", makeTrustProof("llm_derived"), store),
      TierDowngradeError,
    );
  });

  it("rejects same-tier upgrade", async () => {
    const store = freshStore();
    const id = await seedRecord(store, "llm_derived");

    await assert.rejects(
      () => tierUpgrade(id, "llm_derived", makeTrustProof("llm_derived"), store),
      TierDowngradeError,
    );
  });

  it("rejects missing confirmed_by", async () => {
    const store = freshStore();
    const id = await seedRecord(store, "raw_source");
    const proof = { ...makeTrustProof("llm_derived"), confirmed_by: "" };

    await assert.rejects(
      () => tierUpgrade(id, "llm_derived", proof, store),
      InvalidTrustProofError,
    );
  });

  it("rejects human_confirmed upgrade with mismatched proof tier", async () => {
    const store = freshStore();
    const id = await seedRecord(store, "raw_source");
    const proof = makeTrustProof("llm_derived");

    await assert.rejects(
      () => tierUpgrade(id, "human_confirmed", proof, store),
      InvalidTrustProofError,
    );
  });

  it("rejects structurally invalid TrustProof via Zod", async () => {
    const store = freshStore();
    const id = await seedRecord(store, "raw_source");
    const badProof = { tier: "llm_derived", confirmed_by: "a" } as any;

    await assert.rejects(
      () => tierUpgrade(id, "llm_derived", badProof, store),
      InvalidTrustProofError,
    );
  });

  it("rejects upgrade on non-existent record", async () => {
    const store = freshStore();

    await assert.rejects(
      () => tierUpgrade("nonexistent", "llm_derived", makeTrustProof("llm_derived"), store),
      /Memory not found/,
    );
  });

  it("rejects upgrade on revoked record", async () => {
    const store = freshStore();
    const id = await seedRecord(store, "raw_source");
    const record = await store.get(id);
    await store.put({ ...record!, status: "revoked" });

    await assert.rejects(
      () => tierUpgrade(id, "llm_derived", makeTrustProof("llm_derived"), store),
      /non-active/,
    );
  });

  it("appends audit event on successful upgrade", async () => {
    const store = freshStore();
    const id = await seedRecord(store, "raw_source");

    await tierUpgrade(id, "llm_derived", makeTrustProof("llm_derived", "reviewer"), store);

    const events = await getAuditLog(id, store);
    const upgradeEvent = events.find((e) => e.operation === "tier_upgrade");
    assert.ok(upgradeEvent);
    assert.equal(upgradeEvent.principal_id, "reviewer");
    assert.ok(upgradeEvent.details?.includes("raw_source → llm_derived"));
  });

  it("patchTier persists in SQLite", async () => {
    const store = freshStore();
    const id = await seedRecord(store, "raw_source");

    await store.patchTier(id, "human_confirmed", makeTrustProof("human_confirmed"));

    const record = await store.get(id);
    assert.equal(record!.source.tier, "human_confirmed");
  });
});
