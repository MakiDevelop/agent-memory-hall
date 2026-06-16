<script lang="ts">
  import type { AuditTimelineEntry } from "$lib/read-models/decision-detail";

  let { events, highlightedMemoryId = null, onHighlight }: {
    events: AuditTimelineEntry[];
    highlightedMemoryId: string | null;
    onHighlight: (id: string | null) => void;
  } = $props();

  let expandedId = $state<string | null>(null);

  function toggle(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  function formatTime(ts: string): string {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }

  const opColors: Record<string, string> = {
    write: "var(--blue)",
    read: "var(--text-dim)",
    supersede: "var(--yellow)",
    revoke: "var(--red)",
    tier_upgrade: "var(--green)",
    transfer: "var(--accent)",
    rejected: "var(--red)",
    expire: "var(--orange)",
  };
</script>

<div class="timeline">
  {#each events as event}
    {@const isHighlighted = highlightedMemoryId === event.memoryId}
    {@const color = opColors[event.operation] ?? "var(--text-dim)"}
    <div
      class="timeline-entry"
      class:highlighted={isHighlighted}
      class:governance={event.isGovernanceSensitive}
      role="button"
      tabindex="0"
      onclick={() => toggle(event.eventId)}
      onkeydown={(e) => e.key === 'Enter' && toggle(event.eventId)}
      onmouseenter={() => onHighlight(event.memoryId)}
      onmouseleave={() => onHighlight(null)}
    >
      <div class="timeline-dot" style="background: {color}"></div>
      <div class="timeline-content">
        <div class="timeline-header">
          <span class="op-tag" style="color: {color}">{event.operation}</span>
          <span class="timeline-time">{formatTime(event.timestamp)}</span>
        </div>
        <div class="timeline-meta">
          <span class="timeline-principal">{event.principalId}</span>
          <span class="timeline-memory">{event.memoryId}</span>
        </div>
        {#if expandedId === event.eventId}
          <div class="timeline-details">
            {event.details}
          </div>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .timeline {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .timeline-entry {
    display: flex;
    gap: 12px;
    padding: 8px 0;
    cursor: pointer;
    border-left: 2px solid var(--border);
    padding-left: 16px;
    margin-left: 4px;
    transition: all 0.15s;
  }
  .timeline-entry:hover {
    background: var(--bg-hover);
    border-radius: 0 6px 6px 0;
  }
  .timeline-entry.highlighted {
    background: var(--bg-hover);
    border-left-color: var(--accent);
  }
  .timeline-entry.governance {
    border-left-width: 3px;
  }
  .timeline-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-top: 6px;
    flex-shrink: 0;
  }
  .timeline-content {
    flex: 1;
    min-width: 0;
  }
  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .op-tag {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
  }
  .timeline-time {
    font-size: 11px;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }
  .timeline-meta {
    display: flex;
    gap: 8px;
    margin-top: 2px;
  }
  .timeline-principal {
    font-size: 11px;
    color: var(--accent);
    font-family: var(--font-mono);
  }
  .timeline-memory {
    font-size: 11px;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }
  .timeline-details {
    margin-top: 6px;
    padding: 8px;
    background: var(--bg);
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.5;
  }
</style>
