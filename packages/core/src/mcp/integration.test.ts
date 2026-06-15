import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createAmhContext, createAmhServer } from "./server.js";
import { writeMemory } from "../operations/write.js";
import { readMemory } from "../operations/read.js";

describe("MCP server integration", () => {
  it("createAmhServer wires governance from config and caller namespace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "amh-mcp-"));
    const dbPath = join(dir, "test.db");

    const context = await createAmhContext({
      storeType: "sqlite",
      storePath: dbPath,
      callerNamespace: "project:mcp-test",
    });

    const server = createAmhServer(context);
    assert.ok(server);

    const result = await writeMemory(
      {
        agent_id: "codex",
        namespace: "project:mcp-test",
        memory_type: "fact",
        content: "mcp integration",
        source_type: "agent",
        source_ref: "",
        source_tier: "llm_derived",
      },
      context.store,
      {
        dedup: false,
        namespaceIsolation: context.governance.namespaceIsolation,
        writeGate: context.governance.writeGate,
      },
      { callerNamespace: context.callerNamespace }
    );

    const record = await readMemory(result.memory_id, context.store, {
      callerNamespace: context.callerNamespace,
      namespaceIsolation: context.governance.namespaceIsolation,
    });
    assert.ok(record);
    assert.equal(record.content.value, "mcp integration");

    await rm(dir, { recursive: true });
  });
});