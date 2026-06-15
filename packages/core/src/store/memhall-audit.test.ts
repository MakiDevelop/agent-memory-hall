import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemhallStore } from "./memhall.js";

describe("MemhallStore audit persistence", () => {
  it("persists audit events to sidecar file across instances", async () => {
    const dir = await mkdtemp(join(tmpdir(), "amh-memhall-audit-"));
    const auditPath = join(dir, "audit.json");
    const baseUrl = "https://memhall.example.test";

    const store1 = new MemhallStore(baseUrl, "test-token", auditPath);
    await store1.appendAudit({
      event_id: "evt-1",
      memory_id: "mem-1",
      operation: "write",
      principal_id: "agent-a",
      timestamp: "2026-06-15T00:00:00Z",
      details: "created",
    });

    const store2 = new MemhallStore(baseUrl, "test-token", auditPath);
    const events = await store2.getAudit("mem-1");
    assert.equal(events.length, 1);
    assert.equal(events[0].operation, "write");

    const raw = await readFile(auditPath, "utf-8");
    assert.match(raw, /mem-1/);

    await rm(dir, { recursive: true });
  });
});