# Next Session — Agent Memory Hall

> Last updated: 2026-06-15 (AMH v0.7.2 + ACA Layer 3 Identity in progress)

## Done (this session)

1. ~~SQLite/Postgres `patchTier`~~ ✅
2. ~~MCP `amh_tier_upgrade` tool~~ ✅
3. ~~CLI `tier-upgrade` command~~ ✅
4. ~~TrustProofSchema.parse 完整驗證 (.min(1) + Zod)~~ ✅
5. ~~tier-upgrade 單元測試 (12 tests)~~ ✅
6. ~~decision→fact migration + content_hash rehash~~ ✅
7. ~~expire operation + MCP + CLI~~ ✅
8. ~~ProvenanceChain writing (tier-upgrade/transfer/supersede)~~ ✅
9. ~~trust_proof/provenance_chain persistence (new columns)~~ ✅
10. ~~JsonFileStore/MemhallStore decision→fact fallback~~ ✅
11. ~~npm 0.7.1 + 0.7.2 published~~ ✅
12. ~~ACA conformance tests 14/14 (Layer 1: 8 + Layer 2: 5 + cross: 1)~~ ✅
13. ~~ACA Layer 3 Identity spec~~ ✅
14. ~~ACA Layer 3 conformance tests (5 files)~~ ✅

## In Progress

- **AMH Layer 3 Identity adapter** — Principal registry + auth + ACL (→ v0.8.0)

## Grok P1 Fast Follow

- Atomic tier-upgrade (wrap patchTier + provenance in single transaction)
- ProvenanceChain origin at initial write (not just on first transition)

## ACA Next

- Layer 4 Authority spec + conformance tests
- Layer 5 Decision spec
- Governance Plane spec
- AMH adapter for ACA conformance test runner (wire AcaTestAdapter to AMH)

## Publication

- **X thread** — 草稿在 `~/Documents/agent-council/aca-review/x-thread-draft.md`
- **NeurIPS SEA 2026** — abstract deadline ~Sep 2026
- **WMAC @ AAAI 2027** — position paper deadline ~Oct 2026
- **COINE @ AAMAS 2027** — full paper deadline ~Feb 2027
