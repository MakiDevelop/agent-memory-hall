import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeMemory } from "./operations/write.js";
import { queryMemories } from "./operations/read.js";
import { JsonFileStore } from "./store/json-file.js";

describe("Codex handoff CLI paths", () => {
  it("write and read with matching caller-ns isolates namespace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "amh-codex-"));
    const store = new JsonFileStore(join(dir, "handoff.json"));
    const ns = "project:codex-dogfood";

    await writeMemory(
      {
        agent_id: "codex",
        namespace: ns,
        memory_type: "fact",
        content: "handoff from codex",
        source_type: "agent",
        source_ref: "",
        source_tier: "llm_derived",
      },
      store,
      { namespaceIsolation: true },
      { callerNamespace: ns }
    );

    const visible = await queryMemories(
      { agent_id: "codex", limit: 5 },
      store,
      { callerNamespace: ns, namespaceIsolation: true }
    );
    assert.equal(visible.length, 1);
    assert.equal(visible[0].content.value, "handoff from codex");

    const hidden = await queryMemories(
      { agent_id: "codex", limit: 5 },
      store,
      { callerNamespace: "project:other", namespaceIsolation: true }
    );
    assert.equal(hidden.length, 0);

    await rm(dir, { recursive: true });
  });

  it("json store creates parent dir for sandbox workspace paths", async () => {
    const dir = await mkdtemp(join(tmpdir(), "amh-sandbox-"));
    const nested = join(dir, ".amh", "handoff.json");
    const store = new JsonFileStore(nested);

    await writeMemory(
      {
        agent_id: "codex",
        namespace: "project:sandbox",
        memory_type: "fact",
        content: "sandbox write",
        source_type: "agent",
        source_ref: "",
        source_tier: "llm_derived",
      },
      store,
      { namespaceIsolation: true, dedup: false },
      { callerNamespace: "project:sandbox" }
    );

    const results = await queryMemories(
      { agent_id: "codex" },
      store,
      { callerNamespace: "project:sandbox", namespaceIsolation: true }
    );
    assert.equal(results.length, 1);

    await rm(dir, { recursive: true });
  });
});