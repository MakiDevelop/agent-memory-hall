<script lang="ts">
  import type { ProvenanceGraph as PG, ProvenanceNode, ProvenanceEdge } from "$lib/read-models/decision-detail";
  import { onMount } from "svelte";

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

  let containerEl: HTMLDivElement;
  let cy: any = null;
  let selectedNode = $state<ProvenanceNode | null>(null);

  onMount(async () => {
    const cytoscape = (await import("cytoscape")).default;

    const elements: any[] = [];

    for (const node of graph.nodes) {
      elements.push({
        data: {
          id: node.id,
          label: node.id,
          tier: node.tier,
          agent: node.agent,
          status: node.status,
          fullLabel: node.label,
          color: tierColors[node.tier] ?? "#71717a",
        },
      });
    }

    for (const edge of graph.edges) {
      elements.push({
        data: {
          id: `${edge.source}-${edge.target}`,
          source: edge.source,
          target: edge.target,
          label: edge.type,
          performedBy: edge.performedBy,
        },
      });
    }

    cy = cytoscape({
      container: containerEl,
      elements,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            "border-width": 2,
            "border-color": "data(color)",
            "label": "data(label)",
            "font-size": "11px",
            "color": "#e4e4e7",
            "text-valign": "bottom",
            "text-margin-y": 8,
            "font-family": "'JetBrains Mono', monospace",
            "width": 28,
            "height": 28,
            "text-background-color": "#0f1117",
            "text-background-opacity": 0.8,
            "text-background-padding": "3px",
          } as any,
        },
        {
          selector: "node[status = 'superseded']",
          style: {
            "opacity": 0.5,
            "border-style": "dashed",
          },
        },
        {
          selector: "node[status = 'revoked']",
          style: {
            "opacity": 0.4,
            "border-style": "dotted",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 3,
            "border-color": "#818cf8",
            "width": 34,
            "height": 34,
          },
        },
        {
          selector: "node.highlighted",
          style: {
            "border-width": 3,
            "border-color": "#818cf8",
          },
        },
        {
          selector: "edge",
          style: {
            "width": 2,
            "line-color": "#2a2d3a",
            "target-arrow-color": "#2a2d3a",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "label": "data(label)",
            "font-size": "9px",
            "color": "#71717a",
            "text-rotation": "autorotate",
            "text-margin-y": -10,
            "font-family": "'JetBrains Mono', monospace",
          } as any,
        },
        {
          selector: "edge:selected",
          style: {
            "line-color": "#818cf8",
            "target-arrow-color": "#818cf8",
          },
        },
      ],
      layout: {
        name: "breadthfirst",
        directed: true,
        spacingFactor: 1.5,
        avoidOverlap: true,
      },
      userZoomingEnabled: false,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    cy.on("tap", "node", (evt: any) => {
      const nodeData = evt.target.data();
      const node = graph.nodes.find(n => n.id === nodeData.id);
      if (node) {
        selectedNode = selectedNode?.id === node.id ? null : node;
        onHighlight(selectedNode ? node.id : null);
      }
    });

    cy.on("tap", (evt: any) => {
      if (evt.target === cy) {
        selectedNode = null;
        onHighlight(null);
      }
    });

    cy.on("mouseover", "node", (evt: any) => {
      containerEl.style.cursor = "pointer";
    });

    cy.on("mouseout", "node", () => {
      containerEl.style.cursor = "default";
    });

    return () => {
      cy?.destroy();
    };
  });

  $effect(() => {
    if (!cy) return;
    cy.nodes().forEach((n: any) => {
      if (highlightedMemoryId && n.data("id") === highlightedMemoryId) {
        n.addClass("highlighted");
      } else {
        n.removeClass("highlighted");
      }
    });
  });
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

  <div class="graph-container" bind:this={containerEl}></div>

  {#if selectedNode}
    <div class="node-detail">
      <div class="detail-header">
        <span class="detail-id">{selectedNode.id}</span>
        <span class="detail-tier" style="color: {tierColors[selectedNode.tier]}">{tierLabels[selectedNode.tier]}</span>
      </div>
      <p class="detail-label">{selectedNode.label}</p>
      <div class="detail-meta">
        <span class="detail-agent">{selectedNode.agent}</span>
        {#if selectedNode.status !== "active"}
          <span class="detail-status" class:superseded={selectedNode.status === 'superseded'} class:revoked={selectedNode.status === 'revoked'}>{selectedNode.status}</span>
        {/if}
      </div>
      {#each graph.edges.filter(e => e.source === selectedNode?.id || e.target === selectedNode?.id) as edge}
        <div class="detail-edge">
          {edge.source === selectedNode?.id ? "→" : "←"}
          <span class="mono">{edge.source === selectedNode?.id ? edge.target : edge.source}</span>
          <span class="edge-type">{edgeTypeLabels[edge.type] ?? edge.type}</span>
          <span class="edge-by">by {edge.performedBy}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .provenance { min-height: 200px; }
  .legend {
    display: flex;
    gap: 12px;
    margin-bottom: 8px;
    font-size: 11px;
    color: var(--text-dim);
  }
  .legend-item { display: flex; align-items: center; gap: 4px; }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; }

  .graph-container {
    width: 100%;
    height: 220px;
    background: var(--bg);
    border-radius: 6px;
    border: 1px solid var(--border);
  }

  .node-detail {
    margin-top: 8px;
    padding: 10px 12px;
    background: var(--bg);
    border-radius: 6px;
    border: 1px solid var(--accent-dim);
  }
  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  .detail-id {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--accent);
    font-weight: 600;
  }
  .detail-tier { font-size: 11px; font-weight: 600; }
  .detail-label { font-size: 12px; color: var(--text-muted); line-height: 1.4; margin-bottom: 4px; }
  .detail-meta { display: flex; gap: 8px; margin-bottom: 6px; }
  .detail-agent { font-family: var(--font-mono); font-size: 11px; color: var(--accent); }
  .detail-status { font-size: 11px; }
  .detail-status.superseded { color: var(--yellow); }
  .detail-status.revoked { color: var(--red); }
  .detail-edge {
    font-size: 11px;
    color: var(--text-dim);
    padding: 2px 0;
  }
  .mono { font-family: var(--font-mono); }
  .edge-type { color: var(--text-muted); font-family: var(--font-mono); }
  .edge-by { color: var(--accent); font-family: var(--font-mono); }
</style>
