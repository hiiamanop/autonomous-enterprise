<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type EventStreamEvent } from '$lib/api';

  let events = $state<EventStreamEvent[]>([]);
  let status = $state<'connecting' | 'connected' | 'disconnected'>('connecting');
  let filter = $state('ALL');
  const eventTypes = $derived(['ALL', ...new Set(events.map((event) => event.action))]);
  const visibleEvents = $derived(filter === 'ALL' ? events : events.filter((event) => event.action === filter));

  onMount(() => {
    const cleanup = api.listenToEventStream(api.getTenantContext().tenantId, (event) => {
      events = [event, ...events].slice(0, 100);
      status = 'connected';
    });
    status = 'connected';
    return () => cleanup();
  });
</script>

<svelte:head><title>Live Events | AutoEnterprise</title></svelte:head>

<section class="page-content">
  <div class="page-header">
    <div>
      <span class="eyebrow">REAL-TIME EVENT BUS</span>
      <h2>Live Platform Events</h2>
      <p>Tenant-scoped activity from workflows, audit records, and the outbox.</p>
    </div>
    <div class="badge badge-{status === 'connected' ? 'active' : 'warning'}">{status}</div>
  </div>

  <div class="toolbar">
    <label for="event-filter">Filter event type</label>
    <select id="event-filter" bind:value={filter}>
      {#each eventTypes as type}<option value={type}>{type}</option>{/each}
    </select>
  </div>

  <div class="card event-feed">
    {#if visibleEvents.length === 0}
      <div class="empty-state">Waiting for events from this tenant…</div>
    {:else}
      {#each visibleEvents as event}
        <article class="event-row">
          <div class="event-marker"></div>
          <div class="event-main">
            <strong>{event.action}</strong>
            <span>{event.tenantId} · {typeof event.actor === 'object' && event.actor !== null && 'id' in event.actor ? String(event.actor.id) : String(event.actor)}</span>
          </div>
          <time datetime={event.timestamp}>{new Date(event.timestamp).toLocaleTimeString()}</time>
          {#if event.metadata}<code>{JSON.stringify(event.metadata)}</code>{/if}
        </article>
      {/each}
    {/if}
  </div>
</section>

<style>
  .page-content { padding: 2rem; max-width: 1100px; margin: 0 auto; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.5rem; }
  .eyebrow { color: var(--accent-cyan); font: 600 .72rem var(--font-mono); letter-spacing: .12em; }
  h2 { margin: .45rem 0; font-size: 2rem; }
  p, label, time { color: var(--text-secondary); }
  .toolbar { display: flex; align-items: center; gap: .75rem; margin-bottom: 1rem; }
  select { background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); padding: .55rem .75rem; border-radius: .35rem; }
  .event-feed { overflow: hidden; }
  .event-row { display: grid; grid-template-columns: 10px 1fr auto; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-color); align-items: center; }
  .event-row:last-child { border-bottom: 0; }
  .event-marker { width: 8px; height: 8px; border-radius: 50%; background: var(--accent-emerald); box-shadow: 0 0 10px var(--accent-emerald); }
  .event-main { display: grid; gap: .25rem; }
  .event-main span { color: var(--text-secondary); font-size: .82rem; }
  code { grid-column: 2 / -1; color: var(--text-muted); font-size: .76rem; white-space: pre-wrap; }
  .empty-state { padding: 3rem; color: var(--text-muted); text-align: center; }
</style>
