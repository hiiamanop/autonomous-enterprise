<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { api } from '$lib/api';

  let loading = $state(false);
  let autoRefresh = $state(true);
  let lastSync = $state('--:--:--');
  let pollTimer: any = null;
  let cleanupStream: (() => void) | null = null;

  let employees = $state<any[]>([]);
  let deliveries = $state<any[]>([]);
  let overtime = $state<any[]>([]);
  let orders = $state<any[]>([]);
  let lastAssessment = $state<any>(null);

  let staffingEvents = $state<
    Array<{ id: string; time: string; severity: string; detail: string; ticket?: string }>
  >([]);

  const WAREHOUSE_CAPACITY = 4;
  const COURIER_CAPACITY = 5;

  async function loadAll() {
    loading = true;
    try {
      const [empRes, delRes, otRes, ordRes] = await Promise.all([
        api.listEmployees().catch(() => ({ data: [] })),
        api.listDeliveries().catch(() => ({ data: [] })),
        api.listOvertimeRequests().catch(() => ({ data: [] })),
        api.listSalesOrders().catch(() => ({ data: [] }))
      ]);
      employees = empRes.data ?? [];
      deliveries = delRes.data ?? [];
      overtime = otRes.data ?? [];
      orders = ordRes.data ?? [];
      lastSync = new Date().toLocaleTimeString();
    } finally {
      loading = false;
    }
  }

  function isWarehouse(e: any) {
    const p = (e.position ?? '').toUpperCase();
    return p.includes('WAREHOUSE') || p.includes('PICKER') || p.includes('PACKER');
  }

  function isCourier(e: any) {
    const p = (e.position ?? '').toUpperCase();
    return p.includes('COURIER') || p.includes('DRIVER');
  }

  let warehouseStaff = $derived(employees.filter(isWarehouse));
  let courierStaff = $derived(employees.filter(isCourier));

  let pendingOrders = $derived(
    orders.filter((o) => o.status === 'APPROVED' || o.status === 'DRAFT').length
  );
  let activeDeliveries = $derived(
    deliveries.filter((d) => d.status !== 'DELIVERED' && d.status !== 'CANCELLED').length
  );

  let warehouseCapacity = $derived(warehouseStaff.length * WAREHOUSE_CAPACITY);
  let courierCapacity = $derived(courierStaff.length * COURIER_CAPACITY);
  let warehouseUtil = $derived(warehouseCapacity > 0 ? pendingOrders / warehouseCapacity : 0);
  let courierUtil = $derived(courierCapacity > 0 ? activeDeliveries / courierCapacity : 0);

  let severity = $derived.by(() => {
    const peak = Math.max(warehouseUtil, courierUtil);
    if (peak >= 2) return 'CRITICAL';
    if (peak > 1) return 'OVERLOADED';
    if (peak >= 0.75) return 'BUSY';
    return 'NORMAL';
  });

  let pendingOvertime = $derived(overtime.filter((o) => o.status === 'REQUESTED'));

  function sevClass(s: string) {
    if (s === 'CRITICAL') return 'sev-critical';
    if (s === 'OVERLOADED') return 'sev-overloaded';
    if (s === 'BUSY') return 'sev-busy';
    return 'sev-normal';
  }

  function utilClass(u: number) {
    if (u >= 2) return 'bar-critical';
    if (u > 1) return 'bar-over';
    if (u >= 0.75) return 'bar-busy';
    return 'bar-ok';
  }

  function pct(v: number) {
    return `${Math.round((Number(v) || 0) * 100)}%`;
  }

  function courierLoad(courierId: string) {
    return deliveries.filter(
      (d) => d.courierId === courierId && d.status !== 'DELIVERED' && d.status !== 'CANCELLED'
    ).length;
  }

  onMount(async () => {
    await loadAll();

    try {
      cleanupStream = api.subscribeToEvents((event: any) => {
        const meta = event.metadata || {};
        const tool = meta.toolName as string | undefined;

        if (tool === 'assess_staffing_and_act' && meta.result) {
          const r = meta.result;
          lastAssessment = r;
          staffingEvents = [
            {
              id: Math.random().toString(36).slice(2),
              time: new Date().toLocaleTimeString(),
              severity: r.severity ?? 'UNKNOWN',
              detail: Array.isArray(r.actionsTaken) && r.actionsTaken.length
                ? r.actionsTaken.join(' · ')
                : (r.hiringRecommendation ?? 'assessment completed, no action required'),
              ticket: r.escalationTicketId
            },
            ...staffingEvents.slice(0, 29)
          ];
          loadAll();
        } else if (tool === 'request_overtime' && meta.sideEffect !== 'READ') {
          loadAll();
        }
      });
    } catch {
      cleanupStream = null;
    }

    pollTimer = setInterval(() => {
      if (autoRefresh) loadAll();
    }, 5000);
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
    cleanupStream?.();
  });
</script>

<svelte:head><title>Operations — Autonomous Enterprise</title></svelte:head>

<div class="ops-page">
  <div class="page-header">
    <div>
      <div class="title">Operations &amp; Workforce</div>
      <p class="subtitle">
        Fulfilment capacity computed from real HRIS records. Courier assignments, overtime requests
        and escalations below were created autonomously by the HRIS Agent.
      </p>
    </div>
    <div class="header-controls">
      <div class="sync-chip" class:live={autoRefresh}>
        <span class="sync-dot"></span>
        {autoRefresh ? 'AUTO-REFRESH 5s' : 'PAUSED'} · {lastSync}
      </div>
      <button class="ctrl-btn" onclick={() => (autoRefresh = !autoRefresh)}>
        {autoRefresh ? '⏸ Pause' : '▶ Resume'}
      </button>
      <button class="ctrl-btn primary" onclick={loadAll} disabled={loading}>
        {loading ? 'Loading…' : '↻ Refresh'}
      </button>
    </div>
  </div>

  <div class="severity-banner {sevClass(severity)}">
    <div class="sev-left">
      <span class="sev-label">STAFFING SEVERITY</span>
      <span class="sev-value">{severity}</span>
    </div>
    <div class="sev-metrics">
      <div class="sev-metric">
        <span class="sm-label">Pending Orders</span>
        <span class="sm-value">{pendingOrders}</span>
      </div>
      <div class="sev-metric">
        <span class="sm-label">Active Deliveries</span>
        <span class="sm-value">{activeDeliveries}</span>
      </div>
      <div class="sev-metric">
        <span class="sm-label">Warehouse Staff</span>
        <span class="sm-value">{warehouseStaff.length}</span>
      </div>
      <div class="sev-metric">
        <span class="sm-label">Couriers</span>
        <span class="sm-value">{courierStaff.length}</span>
      </div>
    </div>
  </div>

  <div class="util-grid">
    <div class="util-card">
      <div class="util-head">
        <span class="util-name">WAREHOUSE UTILISATION</span>
        <span class="util-pct {utilClass(warehouseUtil)}">{pct(warehouseUtil)}</span>
      </div>
      <div class="util-bar">
        <div
          class="util-fill {utilClass(warehouseUtil)}"
          style="width: {Math.min(100, warehouseUtil * 100)}%"
        ></div>
        <div class="util-marker"></div>
      </div>
      <div class="util-note">
        {pendingOrders} orders ÷ {warehouseCapacity} capacity
        ({warehouseStaff.length} staff × {WAREHOUSE_CAPACITY} orders)
      </div>
    </div>

    <div class="util-card">
      <div class="util-head">
        <span class="util-name">COURIER UTILISATION</span>
        <span class="util-pct {utilClass(courierUtil)}">{pct(courierUtil)}</span>
      </div>
      <div class="util-bar">
        <div
          class="util-fill {utilClass(courierUtil)}"
          style="width: {Math.min(100, courierUtil * 100)}%"
        ></div>
        <div class="util-marker"></div>
      </div>
      <div class="util-note">
        {activeDeliveries} deliveries ÷ {courierCapacity} capacity
        ({courierStaff.length} couriers × {COURIER_CAPACITY} deliveries)
      </div>
    </div>
  </div>

  {#if lastAssessment?.hiringRecommendation}
    <div class="recommendation">
      <span class="rec-icon">🧠</span>
      <div>
        <div class="rec-label">AGENT HIRING RECOMMENDATION</div>
        <div class="rec-text">{lastAssessment.hiringRecommendation}</div>
      </div>
      {#if lastAssessment.escalationTicketId}
        <span class="rec-ticket">ticket {lastAssessment.escalationTicketId.slice(0, 22)}</span>
      {/if}
    </div>
  {/if}

  <div class="two-col">
    <div class="panel">
      <div class="panel-head">
        <span class="panel-title">COURIER ASSIGNMENTS</span>
        <span class="panel-note">{deliveries.length} deliveries</span>
      </div>
      {#if deliveries.length === 0}
        <div class="empty">No deliveries assigned yet. The HRIS Agent assigns couriers when orders are ready.</div>
      {:else}
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Order</th><th>Courier</th><th>Status</th><th class="num">Assigned</th></tr>
            </thead>
            <tbody>
              {#each deliveries.slice(-20).reverse() as d (d.id)}
                <tr>
                  <td class="mono">{d.orderNumber ?? '—'}</td>
                  <td>{d.courierName ?? '—'}</td>
                  <td><span class="status-pill {d.status === 'DELIVERED' ? 'ok' : ''}">{d.status}</span></td>
                  <td class="num muted">
                    {d.assignedAt ? new Date(d.assignedAt).toLocaleTimeString() : '—'}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

    <div class="panel">
      <div class="panel-head">
        <span class="panel-title">COURIER WORKLOAD BALANCE</span>
        <span class="panel-note">cap {COURIER_CAPACITY} each</span>
      </div>
      {#if courierStaff.length === 0}
        <div class="empty">No couriers on staff.</div>
      {:else}
        <div class="courier-list">
          {#each courierStaff as c (c.id)}
            {@const load = courierLoad(c.id)}
            <div class="courier-row">
              <span class="courier-name">{c.fullName}</span>
              <div class="courier-bar">
                <div
                  class="courier-fill {load > COURIER_CAPACITY ? 'bar-over' : 'bar-ok'}"
                  style="width: {Math.min(100, (load / COURIER_CAPACITY) * 100)}%"
                ></div>
              </div>
              <span class="courier-load">{load}/{COURIER_CAPACITY}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <div class="two-col">
    <div class="panel">
      <div class="panel-head">
        <span class="panel-title">OVERTIME REQUESTS</span>
        <span class="panel-note">{pendingOvertime.length} awaiting approval</span>
      </div>
      {#if overtime.length === 0}
        <div class="empty">No overtime requested. Agents create these only when capacity is exceeded.</div>
      {:else}
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Employee</th><th class="num">Hours</th><th>Reason</th><th>Status</th></tr>
            </thead>
            <tbody>
              {#each overtime.slice(-15).reverse() as o (o.id)}
                <tr>
                  <td class="mono">{(o.employeeId ?? '—').slice(0, 18)}</td>
                  <td class="num">{o.hours}h</td>
                  <td class="muted reason">{o.reason ?? '—'}</td>
                  <td><span class="status-pill">{o.status}</span></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

    <div class="panel">
      <div class="panel-head">
        <span class="panel-title">LIVE STAFFING DECISIONS</span>
        <span class="panel-note">HRIS Agent · streamed via SSE</span>
      </div>
      {#if staffingEvents.length === 0}
        <div class="empty">Waiting for HRIS Agent assessments. Start the simulator in Virtual Office.</div>
      {:else}
        <div class="activity-list">
          {#each staffingEvents as e (e.id)}
            <div class="activity-item">
              <span class="act-badge {sevClass(e.severity)}">{e.severity}</span>
              <div class="act-body">
                <span class="act-detail">{e.detail}</span>
                {#if e.ticket}
                  <span class="act-ticket">escalated → {e.ticket.slice(0, 24)}</span>
                {/if}
              </div>
              <span class="act-time">{e.time}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .ops-page { display: flex; flex-direction: column; gap: 1.25rem; }

  .page-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 1rem; flex-wrap: wrap;
  }
  .title { font-size: 1.35rem; font-weight: 700; color: var(--text-primary); }
  .subtitle {
    font-size: 0.85rem; color: var(--text-secondary);
    max-width: 660px; margin-top: 0.25rem; line-height: 1.5;
  }
  .header-controls { display: flex; align-items: center; gap: 0.5rem; }
  .sync-chip {
    display: flex; align-items: center; gap: 0.4rem;
    background: var(--bg-card); border: 1px solid var(--border-color);
    padding: 0.35rem 0.65rem; border-radius: 6px;
    font-size: 0.72rem; font-family: var(--font-mono); color: var(--text-secondary);
  }
  .sync-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-muted); }
  .sync-chip.live .sync-dot {
    background: var(--accent-emerald);
    box-shadow: 0 0 7px var(--accent-emerald);
    animation: pulse 1.4s infinite;
  }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  .ctrl-btn {
    background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-secondary);
    padding: 0.4rem 0.75rem; border-radius: 6px; font-size: 0.78rem; cursor: pointer;
  }
  .ctrl-btn.primary { background: var(--accent-blue); border-color: var(--accent-blue); color: #fff; font-weight: 600; }
  .ctrl-btn:hover { filter: brightness(1.15); }
  .ctrl-btn:disabled { opacity: 0.6; cursor: default; }

  .severity-banner {
    display: flex; align-items: center; justify-content: space-between;
    gap: 1rem; flex-wrap: wrap;
    background: var(--bg-card); border: 1px solid var(--border-color);
    border-left-width: 4px; border-radius: 10px; padding: 1rem 1.25rem;
  }
  .severity-banner.sev-normal { border-left-color: var(--accent-emerald); }
  .severity-banner.sev-busy { border-left-color: #fbbf24; }
  .severity-banner.sev-overloaded { border-left-color: #fb923c; }
  .severity-banner.sev-critical { border-left-color: #ef4444; }
  .sev-left { display: flex; flex-direction: column; gap: 0.15rem; }
  .sev-label {
    font-size: 0.63rem; font-weight: 800; letter-spacing: 0.08em;
    color: var(--text-muted); font-family: var(--font-mono);
  }
  .sev-value { font-size: 1.5rem; font-weight: 800; font-family: var(--font-mono); color: var(--text-primary); }
  .sev-metrics { display: flex; gap: 1.5rem; flex-wrap: wrap; }
  .sev-metric { display: flex; flex-direction: column; gap: 0.1rem; }
  .sm-label { font-size: 0.63rem; color: var(--text-muted); letter-spacing: 0.04em; }
  .sm-value { font-size: 1.1rem; font-weight: 700; font-family: var(--font-mono); color: var(--text-primary); }

  .util-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; }
  .util-card {
    background: var(--bg-card); border: 1px solid var(--border-color);
    border-radius: 10px; padding: 1rem 1.15rem;
    display: flex; flex-direction: column; gap: 0.55rem;
  }
  .util-head { display: flex; align-items: baseline; justify-content: space-between; }
  .util-name {
    font-size: 0.68rem; font-weight: 800; letter-spacing: 0.07em;
    color: var(--text-secondary); font-family: var(--font-mono);
  }
  .util-pct { font-size: 1.25rem; font-weight: 800; font-family: var(--font-mono); }
  .util-bar {
    position: relative; height: 8px; border-radius: 4px;
    background: rgba(148,163,184,0.15); overflow: hidden;
  }
  .util-fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
  .util-marker {
    position: absolute; top: 0; bottom: 0; left: 50%;
    width: 1px; background: rgba(148,163,184,0.5);
  }
  .util-note { font-size: 0.7rem; color: var(--text-muted); font-family: var(--font-mono); }

  .bar-ok, .util-pct.bar-ok { color: var(--accent-emerald); }
  .util-fill.bar-ok, .courier-fill.bar-ok { background: var(--accent-emerald); }
  .bar-busy, .util-pct.bar-busy { color: #fbbf24; }
  .util-fill.bar-busy { background: #fbbf24; }
  .bar-over, .util-pct.bar-over { color: #fb923c; }
  .util-fill.bar-over, .courier-fill.bar-over { background: #fb923c; }
  .bar-critical, .util-pct.bar-critical { color: #ef4444; }
  .util-fill.bar-critical { background: #ef4444; }

  .recommendation {
    display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap;
    background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3);
    border-radius: 10px; padding: 0.85rem 1.15rem;
  }
  .rec-icon { font-size: 1.3rem; }
  .rec-label {
    font-size: 0.62rem; font-weight: 800; letter-spacing: 0.08em;
    color: #fbbf24; font-family: var(--font-mono);
  }
  .rec-text { font-size: 0.85rem; color: var(--text-primary); margin-top: 0.15rem; }
  .rec-ticket {
    margin-left: auto; font-family: var(--font-mono); font-size: 0.66rem;
    color: var(--text-muted); background: rgba(148,163,184,0.12);
    padding: 0.2rem 0.45rem; border-radius: 4px;
  }

  .panel {
    background: var(--bg-card); border: 1px solid var(--border-color);
    border-radius: 10px; overflow: hidden;
  }
  .panel-head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 0.75rem; flex-wrap: wrap;
    padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color);
  }
  .panel-title {
    font-size: 0.7rem; font-weight: 800; letter-spacing: 0.07em;
    color: var(--text-primary); font-family: var(--font-mono);
  }
  .panel-note { font-size: 0.68rem; color: var(--text-muted); font-family: var(--font-mono); }
  .empty { padding: 1.5rem 1rem; text-align: center; font-size: 0.8rem; color: var(--text-muted); }

  .two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1rem; }

  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  thead th {
    text-align: left; font-size: 0.63rem; font-weight: 700; letter-spacing: 0.06em;
    color: var(--text-muted); text-transform: uppercase;
    padding: 0.55rem 0.7rem; border-bottom: 1px solid var(--border-color);
    white-space: nowrap;
  }
  tbody td {
    padding: 0.55rem 0.7rem; font-size: 0.78rem;
    color: var(--text-secondary); border-bottom: 1px solid var(--border-color);
  }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: rgba(148,163,184,0.05); }
  .num { text-align: right; font-family: var(--font-mono); }
  th.num { text-align: right; }
  .mono { font-family: var(--font-mono); font-size: 0.72rem; }
  .muted { color: var(--text-muted); }
  .reason { max-width: 260px; font-size: 0.72rem; }

  .status-pill {
    font-family: var(--font-mono); font-size: 0.64rem; font-weight: 700;
    padding: 0.15rem 0.4rem; border-radius: 4px;
    background: rgba(148,163,184,0.15); color: var(--text-secondary);
  }
  .status-pill.ok { background: rgba(16,185,129,0.16); color: var(--accent-emerald); }

  .courier-list { padding: 0.6rem 0.9rem; display: flex; flex-direction: column; gap: 0.6rem; }
  .courier-row { display: flex; align-items: center; gap: 0.7rem; }
  .courier-name { font-size: 0.78rem; color: var(--text-primary); min-width: 120px; }
  .courier-bar {
    flex: 1; height: 6px; border-radius: 3px;
    background: rgba(148,163,184,0.15); overflow: hidden;
  }
  .courier-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
  .courier-load {
    font-family: var(--font-mono); font-size: 0.7rem;
    color: var(--text-secondary); min-width: 32px; text-align: right;
  }

  .activity-list { max-height: 300px; overflow-y: auto; }
  .activity-item {
    display: flex; align-items: flex-start; gap: 0.6rem;
    padding: 0.55rem 0.9rem; border-bottom: 1px solid var(--border-color);
  }
  .activity-item:last-child { border-bottom: none; }
  .act-badge {
    font-family: var(--font-mono); font-size: 0.58rem; font-weight: 800;
    padding: 0.18rem 0.35rem; border-radius: 3px; flex-shrink: 0;
    background: rgba(148,163,184,0.15); color: var(--text-secondary);
  }
  .act-badge.sev-normal { background: rgba(16,185,129,0.16); color: var(--accent-emerald); }
  .act-badge.sev-busy { background: rgba(251,191,36,0.16); color: #fbbf24; }
  .act-badge.sev-overloaded { background: rgba(251,146,60,0.16); color: #fb923c; }
  .act-badge.sev-critical { background: rgba(239,68,68,0.18); color: #f87171; }
  .act-body { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; flex: 1; }
  .act-detail { font-size: 0.74rem; color: var(--text-secondary); line-height: 1.4; }
  .act-ticket { font-family: var(--font-mono); font-size: 0.64rem; color: #fbbf24; }
  .act-time {
    font-family: var(--font-mono); font-size: 0.62rem;
    color: var(--text-muted); flex-shrink: 0;
  }
</style>
