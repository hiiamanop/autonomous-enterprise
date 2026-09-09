<script lang="ts">
  /**
   * Live end-to-end trace of what the platform does after an input is submitted.
   *
   * The point of this panel is to make causality visible: you submit an order,
   * and you can watch the reservation, the courier assignment, the scaling
   * decision and any escalation arrive as separate audited events rather than
   * having to trust that "something happened".
   *
   * Events arrive over SSE from /api/v1/events/stream, which is the same stream
   * the Virtual Office animates from.
   */
  import { onMount, onDestroy } from 'svelte';
  import { api, type EventStreamEvent } from './api';

  interface Props {
    /** Only show events whose action contains one of these fragments. */
    filter?: string[];
    /** Ring-buffer size; older events are discarded. */
    limit?: number;
    title?: string;
  }

  let { filter = [], limit = 60, title = 'Live E2E Trace' }: Props = $props();

  let events = $state<Array<EventStreamEvent & { _id: number }>>([]);
  let connected = $state(false);
  let paused = $state(false);
  let seq = 0;
  let unsubscribe: (() => void) | null = null;

  const matchesFilter = (action: string) =>
    filter.length === 0 || filter.some((f) => action.toUpperCase().includes(f.toUpperCase()));

  onMount(() => {
    unsubscribe = api.subscribeToEvents((event) => {
      connected = true;
      if (paused) return;

      const action = String(event.action ?? '');
      if (!matchesFilter(action)) return;

      seq += 1;
      // Prepend so the newest event is visible without scrolling, and cap the
      // list so a long-running session cannot grow without bound.
      events = [{ ...event, _id: seq }, ...events].slice(0, limit);
    });
  });

  onDestroy(() => {
    unsubscribe?.();
  });

  function clear() {
    events = [];
  }

  /** Colour-codes an event by outcome so failures stand out at a glance. */
  function toneOf(action: string): 'ok' | 'warn' | 'bad' | 'info' {
    const a = action.toUpperCase();
    if (a.includes('FAIL') || a.includes('REJECT') || a.includes('ERROR')) return 'bad';
    if (a.includes('ESCALAT') || a.includes('BREACH') || a.includes('PAUSED') || a.includes('WARN')) return 'warn';
    if (a.includes('CREATED') || a.includes('SUCCESS') || a.includes('EXECUTED') || a.includes('APPROVED')) return 'ok';
    return 'info';
  }

  function actorOf(event: any): string {
    const actor = event?.actor;
    if (!actor) return 'system';
    if (typeof actor === 'string') return actor;
    return actor.id ?? actor.name ?? 'system';
  }

  function timeOf(event: any): string {
    const ts = event?.timestamp;
    if (!ts) return '';
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString();
  }

  function detailOf(event: any): string {
    const meta = event?.metadata ?? {};
    const bubble = meta.speechBubble ?? meta.reasoning;
    if (bubble) return String(bubble);

    const data = meta.data ?? meta;
    const interesting = [
      'orderNumber',
      'sku',
      'quantity',
      'decision',
      'targetReplicas',
      'ordersPerMinute',
      'severity',
      'courierName',
      'amount'
    ];
    const parts = interesting
      .filter((k) => data?.[k] !== undefined && data?.[k] !== null)
      .map((k) => `${k}=${data[k]}`);

    return parts.join('  ');
  }
</script>

<section class="trace">
  <header class="trace-head">
    <div class="head-left">
      <span class="dot" class:live={connected && !paused} class:paused></span>
      <h3>{title}</h3>
      <span class="count">{events.length}</span>
    </div>
    <div class="head-right">
      <button onclick={() => (paused = !paused)}>{paused ? 'Resume' : 'Pause'}</button>
      <button onclick={clear}>Clear</button>
    </div>
  </header>

  {#if filter.length > 0}
    <p class="filter-note">Filtering on: {filter.join(', ')}</p>
  {/if}

  <div class="stream">
    {#if events.length === 0}
      <p class="empty">
        {connected
          ? 'Connected. Submit something above and the resulting events will appear here.'
          : 'Waiting for the event stream…'}
      </p>
    {:else}
      {#each events as event (event._id)}
        <article class="event {toneOf(String(event.action))}">
          <div class="row-1">
            <code class="action">{event.action}</code>
            <span class="time">{timeOf(event)}</span>
          </div>
          <div class="row-2">
            <span class="actor">{actorOf(event)}</span>
            {#if detailOf(event)}<span class="detail">{detailOf(event)}</span>{/if}
          </div>
        </article>
      {/each}
    {/if}
  </div>
</section>

<style>
  .trace {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 1.1rem 1.25rem 1.25rem;
    display: flex;
    flex-direction: column;
    min-height: 0;
    box-shadow: var(--shadow-sm);
  }

  .trace-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.6rem;
  }

  .head-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .head-left h3 {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-muted);
    flex-shrink: 0;
  }

  .dot.live {
    background: var(--accent-emerald);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-emerald) 25%, transparent);
  }

  .dot.paused {
    background: var(--accent-amber);
  }

  .count {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-muted);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 0.1rem 0.4rem;
    font-weight: 600;
  }

  .head-right {
    display: flex;
    gap: 0.35rem;
  }

  .head-right button {
    background: #ffffff;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    border-radius: 5px;
    padding: 0.25rem 0.65rem;
    font-size: 0.74rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s ease;
  }

  .head-right button:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .filter-note {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
    margin-bottom: 0.6rem;
  }

  .stream {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    overflow-y: auto;
    max-height: 480px;
    min-height: 120px;
  }

  .empty {
    font-size: 0.8rem;
    color: var(--text-muted);
    padding: 1.5rem 0.4rem;
    text-align: center;
    line-height: 1.5;
  }

  .event {
    border: 1px solid var(--border-subtle);
    border-left: 3.5px solid var(--text-muted);
    background: var(--bg-secondary);
    border-radius: 0 7px 7px 0;
    padding: 0.5rem 0.7rem;
    transition: background-color 0.15s ease;
  }

  .event.ok {
    background: #f0fdf4;
    border-color: #dcfce7;
    border-left-color: var(--accent-emerald);
  }
  .event.warn {
    background: #fffbeb;
    border-color: #fef3c7;
    border-left-color: var(--accent-amber);
  }
  .event.bad {
    background: #fff1f2;
    border-color: #ffe4e6;
    border-left-color: var(--accent-rose);
  }
  .event.info {
    background: #eff6ff;
    border-color: #dbeafe;
    border-left-color: var(--accent-blue);
  }

  .row-1 {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.6rem;
  }

  .action {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .time {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .row-2 {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.15rem;
    align-items: baseline;
  }

  .actor {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--accent-blue);
    flex-shrink: 0;
  }

  .detail {
    font-size: 0.7rem;
    color: var(--text-secondary);
    line-height: 1.4;
    word-break: break-word;
  }
</style>
