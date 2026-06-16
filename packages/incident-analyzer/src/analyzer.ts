import type { AmhRecord, AuditEvent } from "@chibakuma/agent-memory-hall";
import type { RuleId } from "./rules.js";

export type IncidentSeverity = "critical" | "high" | "medium" | "low";

export interface Incident {
  rule: RuleId;
  severity: IncidentSeverity;
  message: string;
  memoryId?: string;
  decisionId?: string;
  principalId?: string;
  timestamp?: string;
  evidence: Record<string, unknown>;
}

export interface IncidentReport {
  analyzedAt: string;
  totalMemories: number;
  totalAuditEvents: number;
  incidents: Incident[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
}

interface AnalyzerInput {
  memories: AmhRecord[];
  auditEvents: AuditEvent[];
  decisions?: Array<{
    decision_id: string;
    proposer_principal_id: string;
    risk_level: string;
    reviews: Array<{ reviewer_principal_id: string; position: string }>;
    ratification?: { ratified_by: string } | null;
  }>;
  assignments?: Array<{
    principal_id: string;
    role_id: string;
    scope_namespace?: string | null;
    status: string;
  }>;
}

export function analyzeIncidents(input: AnalyzerInput): IncidentReport {
  const incidents: Incident[] = [];

  checkTrustEscalation(input.memories, incidents);
  checkOuroborosCycle(input.memories, incidents);
  checkRevokeWithoutAudit(input.memories, input.auditEvents, incidents);
  checkTierDowngrade(input.memories, incidents);

  if (input.decisions) {
    checkDecisionWithoutReview(input.decisions, incidents);
    checkSelfApprove(input.decisions, incidents);
  }

  if (input.assignments) {
    checkNamespaceCrossWrite(input.memories, input.assignments, incidents);
  }

  const summary = {
    critical: incidents.filter(i => i.severity === "critical").length,
    high: incidents.filter(i => i.severity === "high").length,
    medium: incidents.filter(i => i.severity === "medium").length,
    low: incidents.filter(i => i.severity === "low").length,
    total: incidents.length,
  };

  return {
    analyzedAt: new Date().toISOString(),
    totalMemories: input.memories.length,
    totalAuditEvents: input.auditEvents.length,
    incidents: incidents.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity)),
    summary,
  };
}

function severityOrder(s: IncidentSeverity): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[s];
}

function checkTrustEscalation(memories: AmhRecord[], incidents: Incident[]): void {
  for (const mem of memories) {
    if (
      mem.source.tier === "human_confirmed" &&
      mem.source.type !== "human" &&
      !mem.trust_proof
    ) {
      incidents.push({
        rule: "trust-escalation",
        severity: "critical",
        message: `Memory ${mem.memory_id} has tier human_confirmed but source type is "${mem.source.type}" with no trust proof`,
        memoryId: mem.memory_id,
        principalId: mem.created_by,
        timestamp: mem.created_at,
        evidence: {
          source_type: mem.source.type,
          source_tier: mem.source.tier,
          trust_proof: null,
        },
      });
    }

    if (mem.provenance_chain?.transitions) {
      for (const t of mem.provenance_chain.transitions) {
        if (t.type === "tier_upgrade" && t.tier_after === "human_confirmed") {
          const upgraderIsHuman = t.performed_by === "maki" || t.performed_by.startsWith("human:");
          if (!upgraderIsHuman && !mem.trust_proof) {
            incidents.push({
              rule: "trust-escalation",
              severity: "critical",
              message: `Memory ${mem.memory_id} was tier-upgraded to human_confirmed by non-human "${t.performed_by}" without trust proof`,
              memoryId: mem.memory_id,
              principalId: t.performed_by,
              timestamp: t.performed_at,
              evidence: { transition: t },
            });
          }
        }
      }
    }
  }
}

function checkOuroborosCycle(memories: AmhRecord[], incidents: Incident[]): void {
  const memoryMap = new Map(memories.map(m => [m.memory_id, m]));

  for (const mem of memories) {
    if (!mem.provenance_chain?.transitions) continue;

    const visited = new Set<string>();
    let current: string | undefined = mem.provenance_chain.origin.memory_id;

    while (current) {
      if (visited.has(current)) {
        incidents.push({
          rule: "ouroboros-cycle",
          severity: "high",
          message: `Circular provenance detected: memory ${mem.memory_id} has a cycle through ${current}`,
          memoryId: mem.memory_id,
          evidence: { cycle_through: current, chain_length: visited.size },
        });
        break;
      }
      visited.add(current);

      const parent = memoryMap.get(current);
      if (!parent?.supersedes) break;
      current = parent.supersedes;
    }
  }

  for (const mem of memories) {
    if (mem.source.tier !== "llm_derived") continue;
    if (!mem.provenance_chain?.transitions) continue;

    for (const t of mem.provenance_chain.transitions) {
      if (t.type === "supersede" && t.tier_before === "llm_derived" && t.tier_after === "llm_derived") {
        const target = memoryMap.get(t.to_memory_id);
        if (target?.source.tier === "llm_derived" && target.source.type === "agent") {
          incidents.push({
            rule: "ouroboros-cycle",
            severity: "high",
            message: `LLM-derived memory ${t.from_memory_id} was superseded by another LLM-derived memory ${t.to_memory_id} — potential ouroboros re-feed`,
            memoryId: t.to_memory_id,
            evidence: { from: t.from_memory_id, to: t.to_memory_id, both_tiers: "llm_derived" },
          });
        }
      }
    }
  }
}

function checkDecisionWithoutReview(
  decisions: NonNullable<AnalyzerInput["decisions"]>,
  incidents: Incident[],
): void {
  for (const dec of decisions) {
    if (dec.risk_level === "high" || dec.risk_level === "critical") {
      if (dec.ratification && dec.reviews.length === 0) {
        incidents.push({
          rule: "decision-without-review",
          severity: "high",
          message: `High-risk decision ${dec.decision_id} was ratified without any independent review`,
          decisionId: dec.decision_id,
          evidence: { risk_level: dec.risk_level, review_count: 0 },
        });
      }
    }
  }
}

function checkSelfApprove(
  decisions: NonNullable<AnalyzerInput["decisions"]>,
  incidents: Incident[],
): void {
  for (const dec of decisions) {
    if (dec.ratification && dec.ratification.ratified_by === dec.proposer_principal_id) {
      incidents.push({
        rule: "self-approve",
        severity: "critical",
        message: `Decision ${dec.decision_id} was both proposed and ratified by "${dec.proposer_principal_id}"`,
        decisionId: dec.decision_id,
        principalId: dec.proposer_principal_id,
        evidence: { proposer: dec.proposer_principal_id, ratifier: dec.ratification.ratified_by },
      });
    }
  }
}

function checkRevokeWithoutAudit(
  memories: AmhRecord[],
  auditEvents: AuditEvent[],
  incidents: Incident[],
): void {
  const revokeAudits = new Set(
    auditEvents.filter(e => e.operation === "revoke").map(e => e.memory_id),
  );

  for (const mem of memories) {
    if (mem.status === "revoked" && !revokeAudits.has(mem.memory_id)) {
      incidents.push({
        rule: "revoke-without-audit",
        severity: "medium",
        message: `Memory ${mem.memory_id} is revoked but has no revoke audit event`,
        memoryId: mem.memory_id,
        evidence: { status: mem.status },
      });
    }
  }
}

function checkNamespaceCrossWrite(
  memories: AmhRecord[],
  assignments: NonNullable<AnalyzerInput["assignments"]>,
  incidents: Incident[],
): void {
  const agentScopes = new Map<string, Set<string>>();

  for (const a of assignments) {
    if (a.status !== "active" || !a.scope_namespace) continue;
    if (!agentScopes.has(a.principal_id)) {
      agentScopes.set(a.principal_id, new Set());
    }
    agentScopes.get(a.principal_id)!.add(a.scope_namespace);
  }

  for (const mem of memories) {
    const scopes = agentScopes.get(mem.agent_id);
    if (scopes && !scopes.has(mem.namespace)) {
      const hasGlobal = assignments.some(
        a => a.principal_id === mem.agent_id && a.status === "active" && !a.scope_namespace,
      );
      if (!hasGlobal) {
        incidents.push({
          rule: "namespace-cross-write",
          severity: "high",
          message: `Agent ${mem.agent_id} wrote to namespace "${mem.namespace}" but is only scoped to [${[...scopes].join(", ")}]`,
          memoryId: mem.memory_id,
          principalId: mem.agent_id,
          evidence: { agent_scopes: [...scopes], target_namespace: mem.namespace },
        });
      }
    }
  }
}

function checkTierDowngrade(memories: AmhRecord[], incidents: Incident[]): void {
  for (const mem of memories) {
    if (!mem.provenance_chain?.transitions) continue;

    for (const t of mem.provenance_chain.transitions) {
      const tierRank = { raw_source: 0, llm_derived: 1, human_confirmed: 2 };
      const before = tierRank[t.tier_before as keyof typeof tierRank] ?? -1;
      const after = tierRank[t.tier_after as keyof typeof tierRank] ?? -1;

      if (after < before) {
        incidents.push({
          rule: "tier-downgrade",
          severity: "medium",
          message: `Memory ${mem.memory_id} had its tier downgraded from ${t.tier_before} to ${t.tier_after}`,
          memoryId: mem.memory_id,
          principalId: t.performed_by,
          timestamp: t.performed_at,
          evidence: { transition: t },
        });
      }
    }
  }
}
