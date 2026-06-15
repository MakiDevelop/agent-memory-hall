import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isExpired, applyLifecycleFilter } from "./lifecycle.js";
import type { AmhRecord } from "../schema/types.js";

const base: AmhRecord = {
  amh_version: "0.1",
  memory_id: "1",
  version: 1,
  status: "active",
  agent_id: "a",
  namespace: "ns",
  memory_type: "fact",
  content: { format: "text/plain", value: "x" },
  source: { type: "agent", ref: "", tier: "llm_derived" },
  created_at: "2026-01-01T00:00:00Z",
  created_by: "a",
};

describe("lifecycle", () => {
  it("detects expired valid_until", () => {
    assert.equal(
      isExpired({ ...base, valid_until: "2020-01-01T00:00:00Z" }),
      true
    );
    assert.equal(
      isExpired({ ...base, valid_until: "2099-01-01T00:00:00Z" }),
      false
    );
  });

  it("filters expired records on read", () => {
    const filtered = applyLifecycleFilter([
      base,
      { ...base, memory_id: "2", valid_until: "2020-01-01T00:00:00Z" },
    ]);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].memory_id, "1");
  });

  it("filters revoked and superseded records", () => {
    const filtered = applyLifecycleFilter([
      base,
      { ...base, memory_id: "2", status: "revoked" },
      { ...base, memory_id: "3", status: "superseded" },
    ]);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].memory_id, "1");
  });
});