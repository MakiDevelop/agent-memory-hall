import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SqliteStore } from "../store/sqlite.js";
import { SqliteIdentityStore } from "./sqlite-identity-store.js";
import {
  AuthenticationError,
  IdentityError,
  authenticate,
  authorize,
  grantPermission,
  registerPrincipal,
  revokeGrant,
  suspendPrincipal,
} from "./operations.js";
import { writeMemory } from "../operations/write.js";
import { tierUpgrade, InvalidTrustProofError } from "../operations/tier-upgrade.js";

function stores(): { memoryStore: SqliteStore; identityStore: SqliteIdentityStore } {
  const memoryStore = new SqliteStore(join(tmpdir(), `amh-identity-${randomUUID()}.db`));
  const identityStore = new SqliteIdentityStore((memoryStore as any).db);
  return { memoryStore, identityStore };
}

describe("Layer 3 identity operations", () => {
  it("registers human, agent, and system principals", async () => {
    const { identityStore } = stores();

    const human = await registerPrincipal("human:maki", "human", "Maki", identityStore);
    const agent = await registerPrincipal("agent:codex", "agent", undefined, identityStore);
    const system = await registerPrincipal("system:cron", "system", undefined, identityStore);

    assert.equal(human.principal_type, "human");
    assert.equal(human.display_name, "Maki");
    assert.equal(agent.principal_type, "agent");
    assert.equal(system.principal_type, "system");
  });

  it("rejects duplicate principals", async () => {
    const { identityStore } = stores();

    await registerPrincipal("human:maki", "human", undefined, identityStore);

    await assert.rejects(
      () => registerPrincipal("human:maki", "human", undefined, identityStore),
      IdentityError,
    );
  });

  it("authenticates valid credentials and rejects invalid or suspended principals", async () => {
    const { identityStore } = stores();
    await registerPrincipal("agent:codex", "agent", undefined, identityStore);

    const principal = await authenticate({ principal_id: "agent:codex" }, identityStore);
    assert.equal(principal.principal_id, "agent:codex");

    await assert.rejects(
      () => authenticate({ principal_id: "agent:missing" }, identityStore),
      AuthenticationError,
    );

    await suspendPrincipal("agent:codex", identityStore);
    await assert.rejects(
      () => authenticate({ principal_id: "agent:codex" }, identityStore),
      AuthenticationError,
    );
  });

  it("authorizes fail-closed when principal or grant is missing", async () => {
    const { identityStore } = stores();
    await registerPrincipal("agent:codex", "agent", undefined, identityStore);

    assert.deepEqual(await authorize("agent:missing", "project:test", "read", identityStore), {
      allowed: false,
      reason: "principal_not_found",
    });
    assert.deepEqual(await authorize("agent:codex", "project:test", "read", identityStore), {
      allowed: false,
      reason: "permission_denied",
    });
  });

  it("grants permissions and authorizes matching namespace actions", async () => {
    const { identityStore } = stores();
    await registerPrincipal("human:maki", "human", undefined, identityStore);
    await registerPrincipal("agent:codex", "agent", undefined, identityStore);

    const grant = await grantPermission(
      "human:maki",
      "agent:codex",
      "project:test",
      ["read", "write"],
      identityStore,
    );

    assert.equal(grant.grantee_principal_id, "agent:codex");
    assert.deepEqual(await authorize("agent:codex", "project:test", "read", identityStore), { allowed: true });
    assert.deepEqual(await authorize("agent:codex", "project:test", "write", identityStore), { allowed: true });
    assert.deepEqual(await authorize("agent:codex", "project:test", "transfer", identityStore), {
      allowed: false,
      reason: "permission_denied",
    });
  });

  it("denies authorization after grant revocation", async () => {
    const { identityStore } = stores();
    await registerPrincipal("human:maki", "human", undefined, identityStore);
    await registerPrincipal("agent:codex", "agent", undefined, identityStore);
    const grant = await grantPermission("human:maki", "agent:codex", "project:test", ["read"], identityStore);

    await revokeGrant(grant.grant_id, "human:maki", identityStore);

    assert.deepEqual(await authorize("agent:codex", "project:test", "read", identityStore), {
      allowed: false,
      reason: "permission_denied",
    });
  });

  it("denies authorization after principal suspension", async () => {
    const { identityStore } = stores();
    await registerPrincipal("human:maki", "human", undefined, identityStore);
    await registerPrincipal("agent:codex", "agent", undefined, identityStore);
    await grantPermission("human:maki", "agent:codex", "project:test", ["read"], identityStore);

    await suspendPrincipal("agent:codex", identityStore);

    assert.deepEqual(await authorize("agent:codex", "project:test", "read", identityStore), {
      allowed: false,
      reason: "principal_suspended",
    });
  });

  it("enforces human principal for human_confirmed tier upgrades when identity is enabled", async () => {
    const { memoryStore, identityStore } = stores();
    await registerPrincipal("human:maki", "human", undefined, identityStore);
    await registerPrincipal("agent:codex", "agent", undefined, identityStore);
    const writeResult = await writeMemory(
      {
        agent_id: "agent:codex",
        namespace: "project:test",
        memory_type: "fact",
        content: "identity tier check",
        source_type: "agent",
        source_ref: "test",
        source_tier: "raw_source",
      },
      memoryStore,
      { dedup: false, antiOuroboros: false, namespaceIsolation: false, writeGate: false },
      { callerNamespace: "project:test" },
    );

    await assert.rejects(
      () => tierUpgrade(
        writeResult.memory_id,
        "human_confirmed",
        {
          tier: "human_confirmed",
          confirmed_by: "agent:codex",
          confirmed_at: new Date().toISOString(),
          evidence_ids: [],
          method: "human_review",
        },
        memoryStore,
        { callerNamespace: "project:test" },
        { enabled: true, enforceHumanTier: true, identityStore },
      ),
      InvalidTrustProofError,
    );

    const result = await tierUpgrade(
      writeResult.memory_id,
      "human_confirmed",
      {
        tier: "human_confirmed",
        confirmed_by: "human:maki",
        confirmed_at: new Date().toISOString(),
        evidence_ids: [],
        method: "human_review",
      },
      memoryStore,
      { callerNamespace: "project:test" },
      { enabled: true, enforceHumanTier: true, identityStore },
    );

    assert.equal(result.new_tier, "human_confirmed");
  });
});
