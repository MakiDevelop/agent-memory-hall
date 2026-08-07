# Baton v2 design history

> Status: historical design note, not an active AMH protocol specification.
> Reviewed: 2026-08-07.

This note preserves the durable decisions from the former
[`session-baton`](https://github.com/MakiDevelop/session-baton) v2 draft while
keeping draft-only and environment-specific proposals out of AMH's active
contract. The original draft remains available in the archived repository at
[`spec/SPEC-v2.md`](https://github.com/MakiDevelop/session-baton/blob/main/spec/SPEC-v2.md).

## Why the standalone service was retired

`session-baton` proved the value of a small cross-session state overlay, but its
runtime duplicated responsibilities that later shipped in AMH and the
memory-hall adapter:

- AMH owns the handoff protocol, namespace governance, lifecycle, audit, and
  agent-facing CLI/MCP surfaces.
- memory-hall owns the shared Baton store and compare-and-swap persistence.
- AMH exposes `amh_baton_read` and `amh_baton_write` when using that backend.

Maintaining a second FastAPI + SQLite service would split the contract and test
surface without adding a distinct capability.

## Durable decisions retained

The following ideas from the v2 draft remain useful design constraints:

1. **Optimistic concurrency for shared state.** A write to a shared Baton can
   carry an expected revision; conflicts must be surfaced instead of silently
   overwriting another writer.
2. **No credentials in handoff state.** Store environment-variable names or
   secret-manager references, never token, key, or password values.
3. **Static safety rules outrank dynamic memory.** A Baton is an operational
   overlay, not a replacement for security rules, bootstrap instructions, or
   human-ratified governance.
4. **Fast handoff and durable memory are different layers.** A compact session
   bridge can accelerate resumption; durable findings and decisions belong in
   governed AMH records and, when ratified, their authoritative knowledge layer.
5. **Bound every mutable section.** Operational state needs count or size limits
   and explicit lifecycle states so it cannot grow into an unreviewable dump.
6. **Untrusted writers propose; governed writers apply.** Agents without an
   authorized write path may emit a structured proposal, but an authorized
   reviewer must validate and apply it.

## Draft proposals not adopted as active AMH contract

The historical draft also contained proposals that are intentionally not
carried forward:

- one monolithic ten-section Baton schema as the universal source of truth;
- storing machine addresses, service endpoints, restart commands, or other
  runtime infrastructure maps inside Baton;
- automatic primary-to-standby failover;
- replacing repository or global safety instructions with dynamic state;
- fixed commands for particular agent vendors or local models;
- automatic promotion of repeated model-derived patterns into rules;
- treating draft source-tier inference as authoritative provenance.

These ideas were either environment-specific, superseded by the four-layer
memory protocol, or unsafe without a separately ratified and enforced contract.

## Current implementation pointers

- [README: Baton overview](../README.md#what-amh-does)
- [AMH ↔ memory-hall integration](INTEGRATION.md)
- [`MemhallStore.batonRead` / `batonWrite`](../packages/core/src/store/memhall.ts)
- [MCP Baton tools](../packages/core/src/mcp/server.ts)
