<script lang="ts">
  import { getMemories, getUniqueValues, getUniqueTiers } from "$lib/read-models/corpus-loader";
  import type { CorpusMemory } from "$lib/read-models/corpus-loader";

  const agents = getUniqueValues("agent_id");
  const types = getUniqueValues("memory_type");
  const statuses = getUniqueValues("status");
  const tiers = getUniqueTiers();

  let filterStatus = $state("");
  let filterType = $state("");
  let filterAgent = $state("");
  let filterTier = $state("");
  let searchQuery = $state("");

  let memories = $derived(
    getMemories({
      status: filterStatus || undefined,
      memory_type: filterType || undefined,
      agent_id: filterAgent || undefined,
      tier: filterTier || undefined,
      q: searchQuery || undefined,
    }),
  );

  let selectedMemory = $state<CorpusMemory | null>(null);

  const tierColors: Record<string, string> = {
    raw_source: "var(--tier-raw)",
    llm_derived: "var(--tier-llm)",
    human_confirmed: "var(--tier-human)",
  };

  const statusIcons: Record<string, string> = {
    active: "●",
    superseded: "◐",
    revoked: "○",
    expired: "◌",
  };

  function formatDate(ts: string): string {
    return new Date(ts).toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  function clearFilters() {
    filterStatus = "";
    filterType = "";
    filterAgent = "";
    filterTier = "";
    searchQuery = "";
  }

  const hasFilters = $derived(
    filterStatus || filterType || filterAgent || filterTier || searchQuery
  );
</script>

<div class="explorer">
  <div class="explorer-header">
    <div>
      <h1>Memory Explorer</h1>
      <p class="subtitle">{memories.length} memories</p>
    </div>
    <a href="/" class="back-link">&larr; Overview</a>
  </div>

  <!-- Filters -->
  <div class="filters card">
    <div class="filter-row">
      <div class="search-box">
        <input type="text" placeholder="Search content or ID..." bind:value={searchQuery} />
      </div>

      <select bind:value={filterStatus}>
        <option value="">All Status</option>
        {#each statuses as s}
          <option value={s}>{s}</option>
        {/each}
      </select>

      <select bind:value={filterType}>
        <option value="">All Types</option>
        {#each types as t}
          <option value={t}>{t}</option>
        {/each}
      </select>

      <select bind:value={filterAgent}>
        <option value="">All Agents</option>
        {#each agents as a}
          <option value={a}>{a}</option>
        {/each}
      </select>

      <select bind:value={filterTier}>
        <option value="">All Tiers</option>
        {#each tiers as t}
          <option value={t}>{t}</option>
        {/each}
      </select>

      {#if hasFilters}
        <button class="clear-btn" onclick={clearFilters}>Clear</button>
      {/if}
    </div>
  </div>

  <div class="content-area">
    <!-- Table -->
    <div class="table-wrapper card">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Status</th>
            <th>Tier</th>
            <th>Agent</th>
            <th>Content</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {#each memories as mem}
            <tr
              class:selected={selectedMemory?.memory_id === mem.memory_id}
              onclick={() => selectedMemory = selectedMemory?.memory_id === mem.memory_id ? null : mem}
            >
              <td class="mono">{mem.memory_id}</td>
              <td><span class="type-tag">{mem.memory_type}</span></td>
              <td>
                <span class="status-indicator" class:active={mem.status === 'active'} class:superseded={mem.status === 'superseded'} class:revoked={mem.status === 'revoked'}>
                  {statusIcons[mem.status] ?? "?"} {mem.status}
                </span>
              </td>
              <td>
                <span class="tier-indicator" style="color: {tierColors[mem.source.tier] ?? 'inherit'}">
                  <span class="tier-dot {mem.source.tier}"></span>
                  {mem.source.tier.replace("_", " ")}
                </span>
              </td>
              <td class="mono agent">{mem.agent_id}</td>
              <td class="content-cell">{mem.content.value}</td>
              <td class="mono date">{formatDate(mem.created_at)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if memories.length === 0}
        <div class="empty">No memories match the current filters.</div>
      {/if}
    </div>

    <!-- Detail Drawer -->
    {#if selectedMemory}
      <div class="detail-drawer card">
        <div class="drawer-header">
          <h2>{selectedMemory.memory_id}</h2>
          <button class="close-btn" onclick={() => selectedMemory = null}>&times;</button>
        </div>

        <div class="drawer-section">
          <h3>Content</h3>
          <p class="content-text">{selectedMemory.content.value}</p>
        </div>

        <div class="drawer-grid">
          <div>
            <h3>Type</h3>
            <span class="type-tag">{selectedMemory.memory_type}</span>
          </div>
          <div>
            <h3>Status</h3>
            <span class="status-indicator" class:active={selectedMemory.status === 'active'} class:superseded={selectedMemory.status === 'superseded'} class:revoked={selectedMemory.status === 'revoked'}>
              {statusIcons[selectedMemory.status]} {selectedMemory.status}
            </span>
          </div>
          <div>
            <h3>Tier</h3>
            <span style="color: {tierColors[selectedMemory.source.tier]}">
              <span class="tier-dot {selectedMemory.source.tier}"></span>
              {selectedMemory.source.tier}
            </span>
          </div>
          <div>
            <h3>Agent</h3>
            <span class="mono agent">{selectedMemory.agent_id}</span>
          </div>
        </div>

        <div class="drawer-section">
          <h3>Source</h3>
          <div class="source-info">
            <span>Type: <strong>{selectedMemory.source.type}</strong></span>
            <span>Ref: <strong class="mono">{selectedMemory.source.ref}</strong></span>
          </div>
        </div>

        {#if selectedMemory.trust_proof}
          <div class="drawer-section">
            <h3>Trust Proof</h3>
            <div class="trust-proof">
              <div>Confirmed by: <strong>{selectedMemory.trust_proof.confirmed_by}</strong></div>
              <div>Method: <strong>{selectedMemory.trust_proof.method}</strong></div>
              <div>At: <strong>{formatDate(selectedMemory.trust_proof.confirmed_at)}</strong></div>
              {#if selectedMemory.trust_proof.evidence_ids.length > 0}
                <div>Evidence: {#each selectedMemory.trust_proof.evidence_ids as eid}<span class="evidence-tag">{eid}</span>{/each}</div>
              {/if}
            </div>
          </div>
        {/if}

        {#if selectedMemory.supersedes}
          <div class="drawer-section">
            <h3>Supersedes</h3>
            <a href="/memories/{selectedMemory.supersedes}" class="supersede-link">{selectedMemory.supersedes}</a>
          </div>
        {/if}

        {#if selectedMemory.provenance_chain}
          <div class="drawer-section">
            <h3>Provenance ({selectedMemory.provenance_chain.transitions.length} transitions)</h3>
            <div class="provenance-mini">
              <div class="prov-origin">
                Origin: <span class="mono">{selectedMemory.provenance_chain.origin.memory_id}</span>
                <span style="color: {tierColors[selectedMemory.provenance_chain.origin.tier]}">{selectedMemory.provenance_chain.origin.tier}</span>
              </div>
              {#each selectedMemory.provenance_chain.transitions as t}
                <div class="prov-transition">
                  <span class="prov-arrow">↓</span>
                  <span class="prov-type">{t.type}</span>
                  <span style="color: {tierColors[t.tier_before]}">{t.tier_before}</span>
                  →
                  <span style="color: {tierColors[t.tier_after]}">{t.tier_after}</span>
                  <span class="mono dim">by {t.performed_by}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <div class="drawer-section">
          <h3>Metadata</h3>
          <div class="meta-info">
            <span>Created: {formatDate(selectedMemory.created_at)}</span>
            <span>By: {selectedMemory.created_by}</span>
            {#if selectedMemory.content_hash}
              <span class="mono dim">Hash: {selectedMemory.content_hash}</span>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .explorer-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }
  .explorer-header h1 { font-size: 24px; font-weight: 700; }
  .subtitle { color: var(--text-dim); font-family: var(--font-mono); font-size: 14px; }
  .back-link { color: var(--text-dim); text-decoration: none; font-size: 13px; }
  .back-link:hover { color: var(--accent); }

  .filters { margin-bottom: 16px; padding: 12px 16px; }
  .filter-row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .search-box { flex: 1; min-width: 200px; }
  .search-box input {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 12px;
    color: var(--text);
    font-size: 13px;
    outline: none;
  }
  .search-box input:focus { border-color: var(--accent); }
  select {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 8px;
    color: var(--text);
    font-size: 12px;
    outline: none;
    cursor: pointer;
  }
  select:focus { border-color: var(--accent); }
  .clear-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 12px;
    color: var(--text-dim);
    font-size: 12px;
    cursor: pointer;
  }
  .clear-btn:hover { border-color: var(--red); color: var(--red); }

  .content-area {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }
  .table-wrapper {
    flex: 1;
    overflow-x: auto;
    padding: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th {
    text-align: left;
    padding: 10px 12px;
    font-size: 11px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--border);
    font-family: var(--font-mono);
    white-space: nowrap;
  }
  td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  tr { cursor: pointer; transition: background 0.15s; }
  tr:hover { background: var(--bg-hover); }
  tr.selected { background: var(--accent-dim); }
  .mono { font-family: var(--font-mono); font-size: 12px; }
  .agent { color: var(--accent); }
  .date { white-space: nowrap; color: var(--text-dim); }
  .content-cell {
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-muted);
  }
  .type-tag {
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 4px;
    background: var(--bg);
    color: var(--text-muted);
    font-family: var(--font-mono);
  }
  .status-indicator { font-size: 12px; white-space: nowrap; }
  .status-indicator.active { color: var(--green); }
  .status-indicator.superseded { color: var(--yellow); }
  .status-indicator.revoked { color: var(--red); }
  .tier-indicator { font-size: 12px; white-space: nowrap; display: flex; align-items: center; }
  .empty {
    padding: 40px;
    text-align: center;
    color: var(--text-dim);
    font-size: 14px;
  }

  .detail-drawer {
    width: 380px;
    flex-shrink: 0;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    position: sticky;
    top: 80px;
  }
  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .drawer-header h2 {
    font-family: var(--font-mono);
    font-size: 16px;
    color: var(--accent);
  }
  .close-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
  }
  .close-btn:hover { color: var(--text); }
  .drawer-section {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }
  .drawer-section h3 {
    font-size: 11px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 6px;
  }
  .content-text {
    font-size: 14px;
    color: var(--text);
    line-height: 1.6;
  }
  .drawer-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }
  .drawer-grid h3 {
    font-size: 11px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 4px;
  }
  .source-info, .meta-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .trust-proof {
    font-size: 13px;
    color: var(--text-muted);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .evidence-tag {
    display: inline-block;
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--accent-dim);
    color: var(--accent);
    font-family: var(--font-mono);
    margin-left: 4px;
  }
  .supersede-link {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--accent);
    text-decoration: none;
  }
  .supersede-link:hover { text-decoration: underline; }
  .provenance-mini {
    font-size: 12px;
  }
  .prov-origin {
    padding: 6px 8px;
    background: var(--bg);
    border-radius: 4px;
    margin-bottom: 4px;
  }
  .prov-transition {
    padding: 4px 8px;
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .prov-arrow { color: var(--text-dim); }
  .prov-type { font-family: var(--font-mono); color: var(--text-muted); }
  .dim { color: var(--text-dim); }
</style>
