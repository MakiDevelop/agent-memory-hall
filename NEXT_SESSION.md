# Next Session — Agent Memory Hall

> Last updated: 2026-06-15 (AMH v0.8.0 + ACA full spec complete)

## Done (this session)

- AMH v0.8.0: tier-upgrade + expire + provenance + trust_proof + Layer 3 Identity (71 tests)
- ACA: 全 6 層 spec + 34 conformance tests
- npm: 0.7.1 / 0.7.2 / 0.8.0 published
- README: 兩個 repo 都更新

## Next (回家 session)

1. **AMH Layer 4 Authority 實作** — Role + RoleAssignment + checkAuthority + escalation
2. **AMH Layer 5 Decision 實作** — Decision lifecycle state machine
3. **AMH Governance Plane 實作** — GovernanceRule + amendment + immutable enforcement
4. **npm 0.9.0** — L4/5 + README 一起 publish

## Grok P1 Fast Follow

- Atomic tier-upgrade (wrap patchTier + provenance in single SQLite transaction)
- ProvenanceChain origin at initial write (not just on first transition)

## ACA Spec Follow-up

- Governance Plane v0.2 (Grok P0: Anti-Ouroboros refine wording, amendment entrenchment, code-level immutability conformance test)
- Layer 5 v0.2 四方 re-review (Codex/Gemini CLI errored; need retry)

## Publication

- **X thread** — 草稿在 `~/Documents/agent-council/aca-review/x-thread-draft.md`
- **NeurIPS SEA 2026** — ~Sep 2026（需 Scout-1 查 2025-2026 related work）
- **WMAC @ AAAI 2027** — ~Oct 2026
- **COINE @ AAMAS 2027** — ~Feb 2027

## Governance Constraint

ACA/AMH 所有變更需四方 review（Claude + Codex + Gemini + Grok）。
Scout 1/2 需求主動 surface 給 Maki。
（memhall 01KV5AZ8C2W87SR4HEQVH133GD）
