import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemhallStore } from "./memhall.js";
import type { AuditEvent } from "../schema/types.js";

const BASE_URL = "https://memhall.example.test";

async function scratch(): Promise<{ dir: string; auditPath: string }> {
  const dir = await mkdtemp(join(tmpdir(), "amh-memhall-audit-"));
  return { dir, auditPath: join(dir, "audit.json") };
}

function event(n: number): AuditEvent {
  return {
    event_id: `evt-${n}`,
    memory_id: `mem-${n}`,
    operation: "write",
    principal_id: "agent-a",
    timestamp: `2026-06-15T00:00:0${n}Z`,
  };
}

async function readLog(auditPath: string): Promise<AuditEvent[]> {
  return JSON.parse(await readFile(auditPath, "utf-8")) as AuditEvent[];
}

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

describe("MemhallStore audit hash chain (OL-013)", () => {
  it("chains each event onto its predecessor, starting from genesis", async () => {
    const { dir, auditPath } = await scratch();
    const store = new MemhallStore(BASE_URL, "t", auditPath);

    await store.appendAudit(event(1));
    await store.appendAudit(event(2));
    await store.appendAudit(event(3));

    const log = await readLog(auditPath);
    assert.equal(log[0].prev_hash, "genesis");
    assert.equal(log[1].prev_hash, log[0].hash);
    assert.equal(log[2].prev_hash, log[1].hash);
    for (const e of log) {
      assert.match(e.hash ?? "", /^[0-9a-f]{64}$/);
    }

    const report = await store.verifyAuditChain();
    assert.deepEqual(report, { total: 3, verified: 3, unchained: 0, breaks: [] });

    await rm(dir, { recursive: true });
  });

  it("detects a mutated event body", async () => {
    const { dir, auditPath } = await scratch();
    const store = new MemhallStore(BASE_URL, "t", auditPath);
    await store.appendAudit(event(1));
    await store.appendAudit(event(2));

    // Rewrite history in place, leaving the stored hash untouched — the exact
    // move the chain exists to expose.
    const log = await readLog(auditPath);
    log[0].principal_id = "attacker";
    await writeFile(auditPath, JSON.stringify(log, null, 2), "utf-8");

    const report = await store.verifyAuditChain();
    assert.deepEqual(report.breaks, [0, 1], "tampered event and its successor must both fail to reconcile");
    assert.equal(report.verified, 0);

    await rm(dir, { recursive: true });
  });

  it("detects a deleted event", async () => {
    const { dir, auditPath } = await scratch();
    const store = new MemhallStore(BASE_URL, "t", auditPath);
    await store.appendAudit(event(1));
    await store.appendAudit(event(2));
    await store.appendAudit(event(3));

    const log = await readLog(auditPath);
    log.splice(1, 1); // excise the middle event
    await writeFile(auditPath, JSON.stringify(log, null, 2), "utf-8");

    const report = await store.verifyAuditChain();
    assert.deepEqual(report.breaks, [1], "the orphaned successor must not reconcile");

    await rm(dir, { recursive: true });
  });

  it("treats pre-OL-013 events as unchained, not as tampering", async () => {
    const { dir, auditPath } = await scratch();
    // Two legacy events with neither prev_hash nor hash, as the live
    // ~/.amh/memhall-audit-*.json holds today.
    await writeFile(auditPath, JSON.stringify([event(1), event(2)], null, 2), "utf-8");

    const store = new MemhallStore(BASE_URL, "t", auditPath);
    await store.appendAudit(event(3));

    const report = await store.verifyAuditChain();
    assert.equal(report.unchained, 2);
    assert.equal(report.verified, 1);
    assert.deepEqual(report.breaks, [], "legacy events must not be reported as breaks");

    const log = await readLog(auditPath);
    assert.equal(log.length, 3, "legacy events must survive the upgrade");
    assert.equal(log[2].prev_hash, "genesis", "chain restarts rather than claiming to cover unhashed history");

    await rm(dir, { recursive: true });
  });

  it("refuses to append onto a corrupt log instead of silently discarding it", async () => {
    const { dir, auditPath } = await scratch();
    // The failure mode observed in ~/.claude/evidence/progress.json on
    // 2026-08-01: a valid document followed by an interleaved-write tail.
    await writeFile(auditPath, JSON.stringify([event(1)], null, 2) + '\n{"partial":', "utf-8");

    const store = new MemhallStore(BASE_URL, "t", auditPath);
    await assert.rejects(() => store.appendAudit(event(2)), /not valid JSON/);

    const raw = await readFile(auditPath, "utf-8");
    assert.match(raw, /evt-1/, "the corrupt log must be left intact for inspection");

    await rm(dir, { recursive: true });
  });

  it("still treats a missing log as an empty one", async () => {
    const { dir, auditPath } = await scratch();
    const store = new MemhallStore(BASE_URL, "t", auditPath);
    assert.deepEqual(await store.getAudit("mem-1"), []);
    await store.appendAudit(event(1));
    assert.equal((await readLog(auditPath)).length, 1);
    await rm(dir, { recursive: true });
  });
});