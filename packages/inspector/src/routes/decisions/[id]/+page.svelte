<script lang="ts">
  import corpus from "../../../../seed/governance-demo.json";
  import { buildDecisionDetail } from "$lib/read-models/decision-detail";
  import type { DecisionDetail } from "$lib/read-models/decision-detail";
  import ProvenanceGraph from "$lib/components/ProvenanceGraph.svelte";
  import AuditTimeline from "$lib/components/AuditTimeline.svelte";

  import { page } from "$app/state";

  const decisionId = page.params.id;

  let detail: DecisionDetail;
  try {
    detail = buildDecisionDetail(corpus, decisionId);
  } catch {
    detail = null as unknown as DecisionDetail;
  }

  let activeSection = $state<string | null>(null);
  let highlightedMemoryId = $state<string | null>(null);

  function highlight(memoryId: string | null) {
    highlightedMemoryId = memoryId;
  }
</script>

{#if !detail}
  <div class="card">
    <h1>Decision not found: {decisionId}</h1>
    <a href="/">&larr; Back to overview</a>
  </div>
{:else}
  <div class="inspector">
    <div class="inspector-header">
      <a href="/" class="back">&larr; Overview</a>
      <h1>{detail.decision.title}</h1>
      <div class="header-badges">
        <span class="badge badge-{detail.decision.riskLevel}">{detail.decision.riskLevel} risk</span>
        <span class="badge badge-{detail.decision.status}">{detail.decision.status}</span>
        <span class="meta">Proposed by <strong>{detail.decision.proposal.evidenceIds.length > 0 ? detail.proposerAuthority.principalId : 'unknown'}</strong> as <strong>{detail.proposerAuthority.roleName}</strong></span>
      </div>
    </div>

    <!-- Horizontal Story Flow -->
    <div class="story-flow">

      <!-- 1. Authority -->
      <section class="card story-section" class:active={activeSection === 'authority'}
        onmouseenter={() => activeSection = 'authority'}
        onmouseleave={() => activeSection = null}>
        <h2>1. Authority</h2>
        <div class="authority-block">
          <div class="authority-item proposer">
            <div class="auth-label">Proposer</div>
            <div class="auth-principal">{detail.proposerAuthority.principalId}</div>
            <div class="auth-role">{detail.proposerAuthority.roleName}</div>
            <div class="auth-caps">
              {#each detail.proposerAuthority.capabilities.slice(0, 4) as cap}
                <span class="cap-tag">{cap}</span>
              {/each}
              {#if detail.proposerAuthority.capabilities.length > 4}
                <span class="cap-tag dim">+{detail.proposerAuthority.capabilities.length - 4}</span>
              {/if}
            </div>
            {#if detail.proposerAuthority.constraints.length > 0}
              <div class="auth-constraints">
                {#each detail.proposerAuthority.constraints as c}
                  <span class="constraint-tag">{c}</span>
                {/each}
              </div>
            {/if}
          </div>

          {#each detail.reviewerAuthorities as reviewer}
            <div class="authority-item reviewer">
              <div class="auth-label">Reviewer</div>
              <div class="auth-principal">{reviewer.principalId}</div>
              <div class="auth-role">{reviewer.roleName}</div>
              <div class="auth-caps">
                {#each reviewer.capabilities.slice(0, 3) as cap}
                  <span class="cap-tag">{cap}</span>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </section>

      <div class="flow-arrow">&rarr;</div>

      <!-- 2. Decision + Reviews -->
      <section class="card story-section wide" class:active={activeSection === 'decision'}
        onmouseenter={() => activeSection = 'decision'}
        onmouseleave={() => activeSection = null}>
        <h2>2. Decision + Reviews</h2>

        <div class="proposal-block">
          <h3>Proposal</h3>
          <div class="proposal-grid">
            <div>
              <h4>Assumptions</h4>
              <ul>
                {#each detail.decision.proposal.assumptions as a}
                  <li>{a}</li>
                {/each}
              </ul>
            </div>
            <div>
              <h4>Risks</h4>
              <ul class="risk-list">
                {#each detail.decision.proposal.risks as r}
                  <li>{r}</li>
                {/each}
              </ul>
            </div>
          </div>
          <div class="trade-offs">
            <h4>Trade-offs</h4>
            {#each detail.decision.proposal.tradeOffs as t}
              <div class="trade-off">{t}</div>
            {/each}
          </div>
        </div>

        <div class="reviews-block">
          <h3>Reviews ({detail.reviewSummary.total})</h3>
          <div class="review-summary-bar">
            {#if detail.reviewSummary.oppose > 0}
              <span class="badge badge-oppose">{detail.reviewSummary.oppose} oppose</span>
            {/if}
            {#if detail.reviewSummary.conditional > 0}
              <span class="badge badge-conditional_approve">{detail.reviewSummary.conditional} conditional</span>
            {/if}
            {#if detail.reviewSummary.approve > 0}
              <span class="badge badge-approve">{detail.reviewSummary.approve} approve</span>
            {/if}
          </div>

          {#each detail.decision.reviews as review}
            <div class="review-card" class:oppose={review.position === 'oppose'} class:approve={review.position === 'approve' || review.position === 'conditional_approve'}>
              <div class="review-header">
                <span class="badge badge-{review.position}">{review.position.replace('_', ' ')}</span>
                <span class="review-by">{review.reviewerPrincipalId}</span>
              </div>
              <p class="review-reasoning">{review.reasoning}</p>
              {#if review.evidenceIds.length > 0}
                <div class="review-evidence">
                  Evidence:
                  {#each review.evidenceIds as eid}
                    <button class="evidence-link" onmouseenter={() => highlight(eid)} onmouseleave={() => highlight(null)}>
                      {eid}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>

        {#if detail.decision.ratification}
          <div class="ratification-block">
            <h3>Ratification</h3>
            <div class="ratification-card">
              <div class="ratified-by">Ratified by <strong>{detail.decision.ratification.ratifiedBy}</strong></div>
              <p>{detail.decision.ratification.rationale}</p>
              {#if detail.decision.ratification.reviewAddressal}
                <div class="addressal">
                  <h4>Dissent Addressal</h4>
                  <p>{detail.decision.ratification.reviewAddressal}</p>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </section>

      <div class="flow-arrow">&rarr;</div>

      <!-- 3. Provenance -->
      <section class="card story-section" class:active={activeSection === 'provenance'}
        onmouseenter={() => activeSection = 'provenance'}
        onmouseleave={() => activeSection = null}>
        <h2>3. Provenance</h2>
        <ProvenanceGraph graph={detail.provenanceGraph} {highlightedMemoryId} onHighlight={highlight} />
      </section>

      <div class="flow-arrow">&rarr;</div>

      <!-- 4. Audit Timeline -->
      <section class="card story-section" class:active={activeSection === 'audit'}
        onmouseenter={() => activeSection = 'audit'}
        onmouseleave={() => activeSection = null}>
        <h2>4. Audit Trail</h2>
        <AuditTimeline events={detail.auditTimeline} {highlightedMemoryId} onHighlight={highlight} />
      </section>
    </div>

    <div class="rollback-section card">
      <h2>Rollback Plan</h2>
      <p>{detail.decision.proposal.rollbackPlan}</p>
    </div>
  </div>
{/if}

<style>
  .inspector-header {
    margin-bottom: 24px;
  }
  .back {
    color: var(--text-dim);
    text-decoration: none;
    font-size: 13px;
    display: inline-block;
    margin-bottom: 8px;
  }
  .back:hover { color: var(--accent); }
  .inspector-header h1 {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 8px;
    line-height: 1.3;
  }
  .header-badges {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .meta {
    font-size: 13px;
    color: var(--text-dim);
  }
  .meta strong { color: var(--text-muted); }

  .story-flow {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    padding-bottom: 16px;
  }
  .story-section {
    transition: border-color 0.2s;
    overflow: hidden;
  }
  .story-section.wide { /* no special width in grid */ }
  .story-section.active {
    border-color: var(--accent);
  }
  .story-section h2 {
    font-size: 13px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 16px;
    font-family: var(--font-mono);
  }
  .flow-arrow {
    display: none;
  }

  .authority-block {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .authority-item {
    padding: 12px;
    border-radius: 6px;
    background: var(--bg);
  }
  .auth-label {
    font-size: 11px;
    color: var(--text-dim);
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .auth-principal {
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 600;
    color: var(--accent);
  }
  .auth-role {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 6px;
  }
  .auth-caps {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 4px;
  }
  .cap-tag {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--accent-dim);
    color: var(--accent);
    font-family: var(--font-mono);
  }
  .cap-tag.dim { opacity: 0.6; }
  .auth-constraints {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }
  .constraint-tag {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--red-dim);
    color: var(--red);
    font-family: var(--font-mono);
  }

  .proposal-block, .reviews-block, .ratification-block {
    margin-bottom: 16px;
  }
  h3 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  h4 {
    font-size: 12px;
    color: var(--text-dim);
    margin-bottom: 4px;
  }
  .proposal-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 8px;
  }
  .proposal-grid ul {
    font-size: 13px;
    padding-left: 16px;
    color: var(--text-muted);
  }
  .risk-list li { color: var(--red); }
  .trade-off {
    font-size: 13px;
    color: var(--text-muted);
    padding: 4px 0;
    border-bottom: 1px solid var(--border);
  }

  .review-summary-bar {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
  }
  .review-card {
    padding: 12px;
    border-radius: 6px;
    background: var(--bg);
    margin-bottom: 8px;
    border-left: 3px solid var(--border);
  }
  .review-card.oppose { border-left-color: var(--red); }
  .review-card.approve { border-left-color: var(--green); }
  .review-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .review-by {
    font-size: 13px;
    font-family: var(--font-mono);
    color: var(--text-muted);
  }
  .review-reasoning {
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
  }
  .review-evidence {
    margin-top: 6px;
    font-size: 12px;
    color: var(--text-dim);
  }
  .evidence-link {
    background: var(--accent-dim);
    color: var(--accent);
    border: none;
    padding: 1px 6px;
    border-radius: 4px;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 11px;
    margin-left: 4px;
    transition: background 0.2s;
  }
  .evidence-link:hover { background: var(--accent); color: white; }

  .ratification-card {
    padding: 12px;
    border-radius: 6px;
    background: var(--green-dim);
    border-left: 3px solid var(--green);
  }
  .ratified-by {
    font-size: 13px;
    color: var(--green);
    margin-bottom: 6px;
  }
  .ratification-card p {
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
  }
  .addressal {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }
  .addressal p { font-style: italic; }

  .rollback-section {
    margin-top: 16px;
  }
  .rollback-section h2 {
    font-size: 13px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 8px;
  }
  .rollback-section p {
    font-size: 14px;
    color: var(--text-muted);
  }
</style>
