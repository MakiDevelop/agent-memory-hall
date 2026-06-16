export interface ProvenanceNode {
  id: string;
  label: string;
  tier: string;
  agent: string;
  status: string;
  timestamp: string;
}

export interface ProvenanceEdge {
  source: string;
  target: string;
  type: string;
  performedBy: string;
  timestamp: string;
}

export interface ProvenanceGraph {
  nodes: ProvenanceNode[];
  edges: ProvenanceEdge[];
}

export interface ReviewSummary {
  total: number;
  approve: number;
  oppose: number;
  conditional: number;
}

export interface AuditTimelineEntry {
  eventId: string;
  memoryId: string;
  operation: string;
  principalId: string;
  timestamp: string;
  details: string;
  isGovernanceSensitive: boolean;
}

export interface AuthorityContext {
  principalId: string;
  roleId: string;
  roleName: string;
  capabilities: string[];
  constraints: string[];
  riskThreshold: number | null;
}

export interface DecisionDetail {
  decision: {
    id: string;
    title: string;
    status: string;
    riskLevel: string;
    createdAt: string;
    effectiveAt: string | null;
    reviewDeadline: string | null;
    proposal: {
      assumptions: string[];
      evidenceIds: string[];
      risks: string[];
      tradeOffs: string[];
      rollbackPlan: string;
      steps: string[];
    };
    reviews: Array<{
      reviewId: string;
      reviewerPrincipalId: string;
      reviewerRoleId: string;
      position: string;
      reasoning: string;
      riskCategories: string[];
      evidenceIds: string[];
    }>;
    ratification: {
      ratifiedBy: string;
      rationale: string;
      reviewAddressal: string | null;
    } | null;
  };
  proposerAuthority: AuthorityContext;
  reviewerAuthorities: AuthorityContext[];
  provenanceGraph: ProvenanceGraph;
  auditTimeline: AuditTimelineEntry[];
  reviewSummary: ReviewSummary;
}

const GOVERNANCE_OPS = new Set([
  "revoke", "supersede", "tier_upgrade", "transfer", "rejected",
]);

interface Corpus {
  roles: Array<Record<string, unknown>>;
  assignments: Array<Record<string, unknown>>;
  memories: Array<Record<string, unknown>>;
  decisions: Array<Record<string, unknown>>;
  audit_events: Array<Record<string, unknown>>;
}

export function buildDecisionDetail(
  corpus: Corpus,
  decisionId: string,
): DecisionDetail {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dec = corpus.decisions.find((d: any) => d.decision_id === decisionId) as any;
  if (!dec) throw new Error(`Decision not found: ${decisionId}`);

  const proposerAssignment = corpus.assignments.find(
    (a: any) => a.principal_id === dec.proposer_principal_id && a.status === "active",
  ) as any;
  const proposerRole = proposerAssignment
    ? corpus.roles.find((r: any) => r.role_id === proposerAssignment.role_id) as any
    : null;

  const proposerAuthority: AuthorityContext = {
    principalId: dec.proposer_principal_id,
    roleId: proposerRole?.role_id ?? "unknown",
    roleName: proposerRole?.display_name ?? "Unknown",
    capabilities: proposerRole?.capabilities ?? [],
    constraints: proposerRole?.constraints ?? [],
    riskThreshold: proposerRole?.risk_threshold ?? null,
  };

  const reviewerAuthorities: AuthorityContext[] = dec.reviews.map((rev: any) => {
    const role = corpus.roles.find((r: any) => r.role_id === rev.reviewer_role_id) as any;
    return {
      principalId: rev.reviewer_principal_id,
      roleId: rev.reviewer_role_id,
      roleName: role?.display_name ?? "Unknown",
      capabilities: role?.capabilities ?? [],
      constraints: role?.constraints ?? [],
      riskThreshold: role?.risk_threshold ?? null,
    };
  });

  const evidenceMemoryIds = new Set<string>([
    ...dec.proposal.evidence_ids,
    ...dec.reviews.flatMap((r: any) => r.evidence_ids),
  ]);
  const evidenceMemories = corpus.memories.filter((m: any) =>
    evidenceMemoryIds.has(m.memory_id),
  );

  const provenanceGraph = buildProvenanceGraph(evidenceMemories, corpus.memories);

  const relatedAuditEvents = corpus.audit_events.filter(
    (e: any) => e.correlation_id === decisionId || evidenceMemoryIds.has(e.memory_id),
  );
  const auditTimeline: AuditTimelineEntry[] = relatedAuditEvents
    .map((e: any) => ({
      eventId: e.event_id,
      memoryId: e.memory_id,
      operation: e.operation,
      principalId: e.principal_id,
      timestamp: e.timestamp,
      details: e.details ?? "",
      isGovernanceSensitive: GOVERNANCE_OPS.has(e.operation),
    }))
    .sort((a: AuditTimelineEntry, b: AuditTimelineEntry) =>
      a.timestamp.localeCompare(b.timestamp),
    );

  const reviewSummary: ReviewSummary = {
    total: dec.reviews.length,
    approve: dec.reviews.filter((r: any) => r.position === "approve").length,
    oppose: dec.reviews.filter((r: any) => r.position === "oppose").length,
    conditional: dec.reviews.filter((r: any) => r.position === "conditional_approve").length,
  };

  return {
    decision: {
      id: dec.decision_id,
      title: dec.title,
      status: dec.status,
      riskLevel: dec.risk_level,
      createdAt: dec.created_at,
      effectiveAt: dec.effective_at ?? null,
      reviewDeadline: dec.review_deadline ?? null,
      proposal: {
        assumptions: dec.proposal.assumptions,
        evidenceIds: dec.proposal.evidence_ids,
        risks: dec.proposal.risks,
        tradeOffs: dec.proposal.trade_offs,
        rollbackPlan: dec.proposal.rollback_plan,
        steps: dec.proposal.implementation_steps,
      },
      reviews: dec.reviews.map((r: any) => ({
        reviewId: r.review_id,
        reviewerPrincipalId: r.reviewer_principal_id,
        reviewerRoleId: r.reviewer_role_id,
        position: r.position,
        reasoning: r.reasoning,
        riskCategories: r.risk_categories_addressed,
        evidenceIds: r.evidence_ids,
      })),
      ratification: dec.ratification
        ? {
            ratifiedBy: dec.ratification.ratified_by,
            rationale: dec.ratification.rationale,
            reviewAddressal: dec.ratification.review_addressal ?? null,
          }
        : null,
    },
    proposerAuthority,
    reviewerAuthorities,
    provenanceGraph,
    auditTimeline,
    reviewSummary,
  };
}

function buildProvenanceGraph(
  evidenceMemories: any[],
  allMemories: any[],
): ProvenanceGraph {
  const nodeMap = new Map<string, ProvenanceNode>();
  const edges: ProvenanceEdge[] = [];
  const visited = new Set<string>();

  function addMemoryNode(mem: any) {
    if (visited.has(mem.memory_id)) return;
    visited.add(mem.memory_id);
    nodeMap.set(mem.memory_id, {
      id: mem.memory_id,
      label: truncate(mem.content?.value ?? mem.memory_id, 60),
      tier: mem.source?.tier ?? "unknown",
      agent: mem.agent_id,
      status: mem.status,
      timestamp: mem.created_at,
    });
  }

  for (const mem of evidenceMemories) {
    addMemoryNode(mem);

    if (mem.supersedes) {
      const parent = allMemories.find((m: any) => m.memory_id === mem.supersedes);
      if (parent) addMemoryNode(parent);
    }

    if (mem.provenance_chain?.transitions) {
      for (const t of mem.provenance_chain.transitions) {
        const fromMem = allMemories.find((m: any) => m.memory_id === t.from_memory_id);
        const toMem = allMemories.find((m: any) => m.memory_id === t.to_memory_id);
        if (fromMem) addMemoryNode(fromMem);
        if (toMem) addMemoryNode(toMem);
        edges.push({
          source: t.from_memory_id,
          target: t.to_memory_id,
          type: t.type,
          performedBy: t.performed_by,
          timestamp: t.performed_at,
        });
      }
    }
  }

  return { nodes: Array.from(nodeMap.values()), edges };
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
