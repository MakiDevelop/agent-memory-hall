import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { MemhallStore } from "./memhall.js";
import type { AmhRecord } from "../schema/types.js";

const BASE = "https://memhall.example.test";

function sampleRecord(): AmhRecord {
  return {
    amh_version: "0.1",
    memory_id: "00000000-0000-4000-8000-000000000001",
    version: 1,
    status: "active",
    agent_id: "codex",
    namespace: "project:integration",
    memory_type: "fact",
    content: { format: "text/plain", value: "integration test content" },
    source: { type: "agent", ref: "session:test", tier: "llm_derived" },
    created_at: "2026-06-15T12:00:00Z",
    created_by: "codex",
  };
}

describe("MemhallStore integration adapter", () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; body?: string }> = [];

  beforeEach(() => {
    calls.length = 0;
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? init.body : undefined;
      calls.push({ url, method, body });

      if (method === "POST" && url.endsWith("/v1/memory/write")) {
        return new Response(
          JSON.stringify({
            entry_id: "01HXMEMHALLULID00000001",
            created: true,
            embedded: true,
            sync_status: "embedded",
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }

      if (method === "PATCH" && url.includes("/v1/memory/")) {
        return new Response(
          JSON.stringify({
            entry: {
              entry_id: "01HXMEMHALLULID00000001",
              metadata: { amh_status: "revoked" },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("adopts server entry_id after write", async () => {
    const store = new MemhallStore(BASE, "token");
    const record = sampleRecord();
    await store.put(record);
    assert.equal(record.memory_id, "01HXMEMHALLULID00000001");
    assert.equal(calls[0]?.method, "POST");
    const payload = JSON.parse(calls[0]?.body ?? "{}") as { metadata: Record<string, unknown> };
    assert.equal(typeof payload.metadata.amh_content_hash, "string");
    assert.ok((payload.metadata.amh_content_hash as string).length > 0);
  });

  it("patchMetadata uses PATCH endpoint", async () => {
    const store = new MemhallStore(BASE, "token");
    await store.patchMetadata("01HXMEMHALLULID00000001", { amh_status: "revoked" });
    assert.equal(calls[0]?.method, "PATCH");
    assert.match(calls[0]?.url ?? "", /\/v1\/memory\/01HXMEMHALLULID00000001$/);
  });
});