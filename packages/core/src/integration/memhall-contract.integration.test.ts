import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MemhallStore } from "../store/memhall.js";
import { writeMemory } from "../operations/write.js";
import { readMemory } from "../operations/read.js";
import { revokeMemory } from "../operations/revoke.js";
import { computeContentHash } from "../governance/dedup.js";

const baseUrl = process.env.MEMHALL_CONTRACT_URL;
const token = process.env.MH_API_TOKEN ?? "contract-test-token";
const describeContract = baseUrl ? describe : describe.skip;

async function waitForHealth(url: string, attempts = 30): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${url}/v1/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`memory-hall not healthy at ${url}`);
}

describeContract("memhall live contract", () => {
  let store: MemhallStore;
  const ns = `project:amh-contract-${randomUUID().slice(0, 8)}`;

  before(async () => {
    await waitForHealth(baseUrl!);
    store = new MemhallStore(baseUrl!, token);
  });

  it("write adopts ULID and findByContentHash resolves", async () => {
    const content = `contract-${randomUUID()}`;
    const result = await writeMemory(
      {
        agent_id: "grok",
        namespace: ns,
        memory_type: "fact",
        content,
        source_type: "agent",
        source_ref: "contract-test",
        source_tier: "human_confirmed",
      },
      store,
      { dedup: true, namespaceIsolation: true },
      { callerNamespace: ns }
    );
    assert.notEqual(result.memory_id.length, 36);
    const hash = computeContentHash(content);
    const dup = await store.findByContentHash(ns, hash);
    assert.equal(dup?.memory_id, result.memory_id);
  });

  it("revoke persists via PATCH", async () => {
    const created = await writeMemory(
      {
        agent_id: "codex",
        namespace: ns,
        memory_type: "fact",
        content: `revoke-${randomUUID()}`,
        source_type: "agent",
        source_ref: "contract-test",
        source_tier: "human_confirmed",
      },
      store,
      { dedup: false, namespaceIsolation: true },
      { callerNamespace: ns }
    );
    await revokeMemory(
      { memory_id: created.memory_id, revoked_by: "codex", reason: "contract" },
      store,
      { namespaceIsolation: true },
      { callerNamespace: ns }
    );
    const inactive = await readMemory(created.memory_id, store, {
      callerNamespace: ns,
      namespaceIsolation: true,
      filterInactive: false,
    });
    assert.equal(inactive?.status, "revoked");
    const hidden = await readMemory(created.memory_id, store, {
      callerNamespace: ns,
      namespaceIsolation: true,
    });
    assert.equal(hidden, null);
  });

  it("supersedes with link edge", async () => {
    const parent = await writeMemory(
      {
        agent_id: "gemini",
        namespace: ns,
        memory_type: "fact",
        content: `parent-${randomUUID()}`,
        source_type: "agent",
        source_ref: "contract-test",
        source_tier: "llm_derived",
      },
      store,
      { dedup: false, namespaceIsolation: true },
      { callerNamespace: ns }
    );
    const child = await writeMemory(
      {
        agent_id: "claude",
        namespace: ns,
        memory_type: "fact",
        content: `child-${randomUUID()}`,
        source_type: "agent",
        source_ref: "contract-test",
        source_tier: "human_confirmed",
        supersedes: parent.memory_id,
      },
      store,
      { dedup: false, namespaceIsolation: true },
      { callerNamespace: ns }
    );
    assert.notEqual(child.memory_id, parent.memory_id);
    const parentInactive = await readMemory(parent.memory_id, store, {
      callerNamespace: ns,
      namespaceIsolation: true,
      filterInactive: false,
    });
    assert.equal(parentInactive?.status, "superseded");
    const got = await store.get(child.memory_id);
    assert.ok(got);
  });
});