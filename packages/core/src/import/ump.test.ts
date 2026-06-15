import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { convertUmpToAmh, convertAmhToUmp } from "./ump.js";
import type { AmhRecord } from "../schema/types.js";

describe("UMP import", () => {
  it("maps UMP record to AMH with source tier", () => {
    const amh = convertUmpToAmh({
      id: "urn:ump:abc123",
      kind: "semantic",
      body: "Team prefers PostgreSQL",
      scope: { owner: "planner", namespace: "project:acme" },
      provenance: { actor: "planner", actor_kind: "human", source: "session:1" },
      created: "2026-06-15T09:30:00Z",
    });

    assert.equal(amh.memory_id, "abc123");
    assert.equal(amh.namespace, "project:acme");
    assert.equal(amh.source.tier, "human_confirmed");
    assert.equal(amh.memory_type, "fact");
  });

  it("round-trips core fields to UMP", () => {
    const amh: AmhRecord = {
      amh_version: "0.1",
      memory_id: "mem-1",
      version: 1,
      status: "active",
      agent_id: "planner",
      namespace: "project:acme",
      memory_type: "lesson",
      content: { format: "text/markdown", value: "Lesson learned" },
      source: { type: "agent", ref: "session:1", tier: "llm_derived" },
      created_at: "2026-06-15T09:30:00Z",
      created_by: "planner",
    };

    const ump = convertAmhToUmp(amh);
    const back = convertUmpToAmh(ump);
    assert.equal(back.namespace, amh.namespace);
    assert.equal(back.content.value, amh.content.value);
    assert.equal(back.memory_type, amh.memory_type);
  });
});