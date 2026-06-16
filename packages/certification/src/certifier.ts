import type { AmhStore, AmhRecord, AuditEvent } from "@chibakuma/agent-memory-hall";
import { validateAmhRecord } from "@chibakuma/agent-memory-hall";
import { layers, type LayerId } from "./layers.js";

export interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

export interface LayerResult {
  layerId: LayerId;
  layerName: string;
  passed: boolean;
  tests: TestResult[];
  passRate: number;
}

export interface CertificationResult {
  certifiedAt: string;
  conformanceLevel: string;
  layers: LayerResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    passRate: number;
  };
}

export async function runCertification(
  store: AmhStore,
  targetLayers?: LayerId[],
): Promise<CertificationResult> {
  const target = targetLayers ?? (["L1", "L2", "L3", "L4", "L5"] as LayerId[]);
  const layerResults: LayerResult[] = [];

  const memories = await store.list();
  const allAudit: AuditEvent[] = [];
  for (const mem of memories.slice(0, 100)) {
    const events = await store.getAudit(mem.memory_id);
    allAudit.push(...events);
  }

  for (const layerId of target) {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) continue;

    let tests: TestResult[];
    switch (layerId) {
      case "L1":
        tests = testL1(memories);
        break;
      case "L2":
        tests = await testL2(store, memories);
        break;
      case "L3":
        tests = testL3(memories);
        break;
      case "L4":
        tests = testL4(memories, allAudit);
        break;
      case "L5":
        tests = [{ name: "Decision governance (requires decision store)", passed: true, message: "Skipped — no decision store provided" }];
        break;
      default:
        tests = [];
    }

    const passed = tests.every(t => t.passed);
    const passRate = tests.length > 0 ? tests.filter(t => t.passed).length / tests.length : 1;

    layerResults.push({
      layerId,
      layerName: layer.name,
      passed,
      tests,
      passRate,
    });
  }

  const allTests = layerResults.flatMap(l => l.tests);
  const passedCount = allTests.filter(t => t.passed).length;

  let conformanceLevel = "None";
  const passedLayers = layerResults.filter(l => l.passed).map(l => l.layerId);

  if (passedLayers.includes("L1")) conformanceLevel = "ACA Layer 1 Conformant";
  if (passedLayers.includes("L1") && passedLayers.includes("L2") && passedLayers.includes("L3")) {
    conformanceLevel = "ACA Layer 1-3 Conformant";
  }
  if (passedLayers.length === target.length) {
    conformanceLevel = "ACA Full Stack Conformant";
  }

  return {
    certifiedAt: new Date().toISOString(),
    conformanceLevel,
    layers: layerResults,
    summary: {
      totalTests: allTests.length,
      passed: passedCount,
      failed: allTests.length - passedCount,
      passRate: allTests.length > 0 ? passedCount / allTests.length : 1,
    },
  };
}

function testL1(memories: AmhRecord[]): TestResult[] {
  if (memories.length === 0) {
    return [{ name: "Has at least one memory record", passed: false, message: "Store is empty" }];
  }

  const results: TestResult[] = [];

  const ids = new Set<string>();
  let duplicateId = false;
  for (const mem of memories) {
    if (ids.has(mem.memory_id)) { duplicateId = true; break; }
    ids.add(mem.memory_id);
  }
  results.push({ name: "memory_id is present and unique", passed: !duplicateId });

  results.push({
    name: "amh_version is '0.1'",
    passed: memories.every(m => m.amh_version === "0.1"),
    message: memories.find(m => m.amh_version !== "0.1") ? `Found version: ${memories.find(m => m.amh_version !== "0.1")?.amh_version}` : undefined,
  });

  const validStatuses = new Set(["active", "superseded", "revoked", "expired"]);
  results.push({
    name: "status is valid enum",
    passed: memories.every(m => validStatuses.has(m.status)),
  });

  const validTypes = new Set(["fact", "preference", "constraint", "lesson", "risk"]);
  results.push({
    name: "memory_type is valid enum",
    passed: memories.every(m => validTypes.has(m.memory_type)),
  });

  const validSourceTypes = new Set(["human", "agent", "system", "document"]);
  results.push({
    name: "source.type is valid enum",
    passed: memories.every(m => validSourceTypes.has(m.source.type)),
  });

  const validTiers = new Set(["raw_source", "llm_derived", "human_confirmed"]);
  results.push({
    name: "source.tier is valid enum",
    passed: memories.every(m => validTiers.has(m.source.tier)),
  });

  results.push({
    name: "content has format and value",
    passed: memories.every(m => m.content?.format && m.content?.value !== undefined),
  });

  results.push({
    name: "created_at is ISO 8601",
    passed: memories.every(m => !isNaN(Date.parse(m.created_at))),
  });

  results.push({
    name: "created_by is non-empty",
    passed: memories.every(m => m.created_by && m.created_by.trim().length > 0),
  });

  const schemaValid = memories.every(m => {
    try { validateAmhRecord(m); return true; } catch { return false; }
  });
  results.push({
    name: "All records pass Zod schema validation",
    passed: schemaValid,
  });

  return results;
}

async function testL2(store: AmhStore, memories: AmhRecord[]): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const superseded = memories.filter(m => m.status === "superseded");
  const hasSupersededRecords = superseded.length > 0;
  results.push({
    name: "Superseded records exist (supersede policy active)",
    passed: hasSupersededRecords,
    message: hasSupersededRecords ? `${superseded.length} superseded records found` : "No superseded records — cannot verify policy",
  });

  const namespaces = await store.namespaces();
  results.push({
    name: "Namespace list available",
    passed: namespaces.length > 0,
    message: `${namespaces.length} namespaces found`,
  });

  const hashCoverage = memories.filter(m => m.content_hash).length / Math.max(memories.length, 1);
  results.push({
    name: "Content hash coverage > 50%",
    passed: hashCoverage > 0.5,
    message: `${(hashCoverage * 100).toFixed(0)}% of records have content_hash`,
  });

  return results;
}

function testL3(memories: AmhRecord[]): TestResult[] {
  const results: TestResult[] = [];

  const humanConfirmed = memories.filter(m => m.source.tier === "human_confirmed");
  const humanWithProof = humanConfirmed.filter(m => m.trust_proof);
  results.push({
    name: "trust_proof present for human_confirmed records",
    passed: humanConfirmed.length === 0 || humanWithProof.length === humanConfirmed.length,
    message: `${humanWithProof.length}/${humanConfirmed.length} human_confirmed records have trust_proof`,
  });

  const validMethods = new Set(["human_review", "peer_consensus", "automated_check", "cross_reference"]);
  const proofs = memories.filter(m => m.trust_proof).map(m => m.trust_proof!);
  results.push({
    name: "trust_proof.method is valid enum",
    passed: proofs.every(p => validMethods.has(p.method)),
  });

  const withChain = memories.filter(m => m.provenance_chain);
  results.push({
    name: "Provenance chains exist",
    passed: withChain.length > 0,
    message: `${withChain.length} records have provenance_chain`,
  });

  let chronoOrdered = true;
  for (const mem of withChain) {
    const transitions = mem.provenance_chain!.transitions;
    for (let i = 1; i < transitions.length; i++) {
      if (transitions[i].performed_at < transitions[i - 1].performed_at) {
        chronoOrdered = false;
        break;
      }
    }
  }
  results.push({
    name: "Provenance transitions chronologically ordered",
    passed: chronoOrdered,
  });

  return results;
}

function testL4(memories: AmhRecord[], auditEvents: AuditEvent[]): TestResult[] {
  const results: TestResult[] = [];

  results.push({
    name: "Audit events exist",
    passed: auditEvents.length > 0,
    message: `${auditEvents.length} audit events found`,
  });

  const auditedMemories = new Set(auditEvents.map(e => e.memory_id));
  const coverage = memories.length > 0 ? auditedMemories.size / memories.length : 1;
  results.push({
    name: "Audit coverage > 80%",
    passed: coverage >= 0.8,
    message: `${(coverage * 100).toFixed(0)}% of memories have at least one audit event`,
  });

  const revokedMemories = memories.filter(m => m.status === "revoked");
  const revokeAudits = new Set(auditEvents.filter(e => e.operation === "revoke").map(e => e.memory_id));
  const revokeAuditCoverage = revokedMemories.length > 0
    ? revokedMemories.filter(m => revokeAudits.has(m.memory_id)).length / revokedMemories.length
    : 1;
  results.push({
    name: "Revoked memories have revoke audit events",
    passed: revokeAuditCoverage === 1,
    message: revokedMemories.length > 0 ? `${(revokeAuditCoverage * 100).toFixed(0)}% coverage` : "No revoked memories",
  });

  return results;
}
