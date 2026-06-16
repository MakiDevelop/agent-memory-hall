<script lang="ts">
  import corpus from "../../seed/governance-demo.json";
  import { buildDecisionDetail } from "$lib/read-models/decision-detail";

  const detail = buildDecisionDetail(corpus, "dec-001");
  const tierCounts = {
    raw_source: corpus.memories.filter(m => m.source.tier === "raw_source").length,
    llm_derived: corpus.memories.filter(m => m.source.tier === "llm_derived").length,
    human_confirmed: corpus.memories.filter(m => m.source.tier === "human_confirmed").length,
  };
  const statusCounts = {
    active: corpus.memories.filter(m => m.status === "active").length,
    superseded: corpus.memories.filter(m => m.status === "superseded").length,
    revoked: corpus.memories.filter(m => m.status === "revoked").length,
  };
</script>

<div class="overview">
  <h1>Governance Overview</h1>
  <p class="subtitle">project:alpha namespace</p>

  <div class="stats-grid">
    <div class="card stat">
      <div class="stat-value">{corpus.memories.length}</div>
      <div class="stat-label">Memories</div>
      <div class="stat-breakdown">
        <span class="tier-raw_source">{tierCounts.raw_source} raw</span>
        <span class="tier-llm_derived">{tierCounts.llm_derived} llm</span>
        <span class="tier-human_confirmed">{tierCounts.human_confirmed} human</span>
      </div>
    </div>
    <div class="card stat">
      <div class="stat-value">{corpus.audit_events.length}</div>
      <div class="stat-label">Audit Events</div>
      <div class="stat-breakdown">
        <span>{corpus.audit_events.filter(e => ['revoke','supersede','tier_upgrade'].includes(e.operation)).length} governance-sensitive</span>
      </div>
    </div>
    <div class="card stat">
      <div class="stat-value">{corpus.decisions.length}</div>
      <div class="stat-label">Decisions</div>
      <div class="stat-breakdown">
        <span class="badge badge-{detail.decision.status}">{detail.decision.status}</span>
      </div>
    </div>
    <div class="card stat">
      <div class="stat-value">{corpus.roles.length}</div>
      <div class="stat-label">Roles</div>
      <div class="stat-breakdown">
        <span>{corpus.assignments.length} assignments</span>
      </div>
    </div>
  </div>

  <div class="card cta-card">
    <h2>Featured Decision</h2>
    <p class="decision-title">{detail.decision.title}</p>
    <div class="decision-meta">
      <span class="badge badge-{detail.decision.riskLevel}">{detail.decision.riskLevel} risk</span>
      <span class="badge badge-{detail.decision.status}">{detail.decision.status}</span>
      <span class="meta-text">{detail.reviewSummary.oppose} dissent / {detail.reviewSummary.conditional} conditional / {detail.reviewSummary.approve} approve</span>
    </div>
    <a href="/decisions/dec-001" class="cta-button">Inspect Decision &rarr;</a>
  </div>

  <div class="card">
    <h2>Memory Status</h2>
    <div class="status-bar">
      <div class="status-segment active" style="width: {statusCounts.active / corpus.memories.length * 100}%">
        {statusCounts.active} active
      </div>
      <div class="status-segment superseded" style="width: {statusCounts.superseded / corpus.memories.length * 100}%">
        {statusCounts.superseded} superseded
      </div>
      <div class="status-segment revoked" style="width: {statusCounts.revoked / corpus.memories.length * 100}%">
        {statusCounts.revoked} revoked
      </div>
    </div>
  </div>
</div>

<style>
  .overview h1 {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .subtitle {
    color: var(--text-dim);
    font-family: var(--font-mono);
    font-size: 14px;
    margin-bottom: 24px;
  }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }
  .stat { text-align: center; }
  .stat-value {
    font-size: 36px;
    font-weight: 800;
    font-family: var(--font-mono);
    color: var(--accent);
  }
  .stat-label {
    font-size: 14px;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .stat-breakdown {
    display: flex;
    gap: 8px;
    justify-content: center;
    font-size: 12px;
    color: var(--text-dim);
  }
  .cta-card { margin-bottom: 24px; }
  .cta-card h2 {
    font-size: 14px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 8px;
  }
  .decision-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .decision-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }
  .meta-text {
    font-size: 13px;
    color: var(--text-dim);
  }
  .cta-button {
    display: inline-block;
    background: var(--accent-dim);
    color: white;
    padding: 8px 20px;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
    transition: background 0.2s;
  }
  .cta-button:hover { background: var(--accent); }
  .card h2 {
    font-size: 14px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 12px;
  }
  .status-bar {
    display: flex;
    border-radius: 6px;
    overflow: hidden;
    height: 32px;
    font-size: 12px;
    font-weight: 600;
  }
  .status-segment {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 60px;
  }
  .status-segment.active { background: var(--green-dim); color: var(--green); }
  .status-segment.superseded { background: var(--yellow-dim); color: var(--yellow); }
  .status-segment.revoked { background: var(--red-dim); color: var(--red); }
</style>
