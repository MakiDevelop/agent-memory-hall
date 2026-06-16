<script lang="ts">
  import type { ProvenanceGraph as PG } from "$lib/read-models/decision-detail";

  let { graph, highlightedMemoryId = null, onHighlight }: {
    graph: PG;
    highlightedMemoryId: string | null;
    onHighlight: (id: string | null) => void;
  } = $props();

  const tierColors: Record<string, string> = {
    raw_source: "#fb923c",
    llm_derived: "#60a5fa",
    human_confirmed: "#34d399",
  };

  const tierLabels: Record<string, string> = {
    raw_source: "Raw Source",
    llm_derived: "LLM Derived",
    human_confirmed: "Human Confirmed",
  };

  const edgeTypeLabels: Record<string, string> = {
    supersede: "superseded by",
    tier_upgrade: "upgraded to",
    transfer: "transferred to",
  };
</script>

<div class="provenance">
  <div class="legend">
    {#each Object.entries(tierColors) as [tier, color]}
      <span class="legend-item">
        <span class="legend-dot" style="background: {color}"></span>
        {tierLabels[tier] ?? tier}
      </span>
    {/each}
  </div>

  <div class="graph-container">
    {#each graph.nodes as node, i}
      {@const isHighlighted = highlightedMemoryId === node.id}
      {@const isSuperseded = node.status === "superseded"}
      {@const color = tierColors[node.tier] ?? "#71717a"}
      <div
        class="graph-node"
        class:highlighted={isHighlighted}
        class:superseded={isSuperseded}
        style="border-color: {color}"
        role="button"
        tabindex="0"
        onmouseenter={() => onHighlight(node.id)}
        onmouseleave={() => onHighlight(null)}
        onfocus={() => onHighlight(node.id)}
        onblur={() => onHighlight(null)}
      >
        <div class="node-header">
          <span class="node-id">{node.id}</span>
          <span class="node-tier" style="color: {color}">{tierLabels[node.tier] ?? node.tier}</span>
        </div>
        <div class="node-label">{node.label}</div>
        <div class="node-meta">
          <span class="node-agent">{node.agent}</span>
          {#if isSuperseded}
            <span class="node-status superseded">superseded</span>
          {/if}
        </div>
      </div>

      {#if i < graph.nodes.length - 1}
        {@const edge = graph.edges.find(e => e.source === node.id)}
        {#if edge}
          <div class="graph-edge">
            <div class="edge-line"></div>
            <div class="edge-label">{edgeTypeLabels[edge.type] ?? edge.type}</div>
            <div class="edge-by">{edge.performedBy}</div>
          </div>
        {/if}
      {/if}
    {/each}
  </div>
</div>

<style>
  .provenance {
    min-height: 200px;
  }
  .legend {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    font-size: 11px;
    color: var(--text-dim);
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .graph-container {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .graph-node {
    padding: 10px 12px;
    border-radius: 6px;
    background: var(--bg);
    border-left: 3px solid;
    cursor: pointer;
    transition: all 0.2s;
  }
  .graph-node:hover, .graph-node.highlighted {
    background: var(--bg-hover);
    transform: translateX(4px);
  }
  .graph-node.superseded {
    opacity: 0.5;
  }
  .graph-node.superseded.highlighted {
    opacity: 0.8;
  }
  .node-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  .node-id {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-dim);
  }
  .node-tier {
    font-size: 10px;
    font-weight: 600;
  }
  .node-label {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.4;
  }
  .node-meta {
    display: flex;
    justify-content: space-between;
    margin-top: 4px;
  }
  .node-agent {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--accent);
  }
  .node-status.superseded {
    font-size: 10px;
    color: var(--yellow);
  }

  .graph-edge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0 4px 14px;
  }
  .edge-line {
    width: 2px;
    height: 20px;
    background: var(--border);
  }
  .edge-label {
    font-size: 10px;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }
  .edge-by {
    font-size: 10px;
    color: var(--accent);
    font-family: var(--font-mono);
  }
</style>
