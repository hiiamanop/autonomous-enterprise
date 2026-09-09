<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { api } from '$lib/api';

  let loading = $state(false);
  let autoRefresh = $state(true);
  let lastSync = $state('--:--:--');
  let pollTimer: any = null;
  let cleanupStream: (() => void) | null = null;

  let kpis = $state<any[]>([]);
  let channelSummary = $state<any>(null);
  let orders = $state<any[]>([]);
  let agentActivity = $state<
    Array<{ id: string; time: string; tool: string; detail: string; write: boolean }>
  >([]);

  const SALES_TOOLS = new Set([
    'create_sales_order',
    'close_sales_lead',
    'list_sales_orders',
    'get_sales_rep_kpis',
    'get_channel_summary'
  ]);

  async function loadAll() {
    loading = true;
    try {
      const [kpiRes, chanRes, orderRes] = await Promise.all([
        api.getSalesRepKpis().catch(() => ({ data: [] })),
        api.getChannelSummary().catch(() => ({ data: null })),
        api.listSalesOrders().catch(() => ({ data: [] }))
      ]);
      kpis = (kpiRes.data ?? []).slice().sort((a: any, b: any) => b.kpiScore - a.kpiScore);
      channelSummary = chanRes.data ?? null;
      orders = orderRes.data ?? [];
      lastSync = new Date().toLocaleTimeString();
    } finally {
      loading = false;
    }
  }

  function ratingClass(rating: string) {
    if (rating === 'A') return 'rating-a';
    if (rating === 'B') return 'rating-b';
    if (rating === 'C') return 'rating-c';
    return 'rating-d';
  }

  function money(v: number) {
    return `$${(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function pct(v: number) {
    return `${Math.round((Number(v) || 0) * 100)}%`;
  }

  let marketplaceOrders = $derived(orders.filter((o) => o.channel === 'MARKETPLACE'));
  let directOrders = $derived(orders.filter((o) => o.channel === 'DIRECT_SALES'));
  let openLeads = $derived(directOrders.filter((o) => o.leadOutcome === 'PENDING'));
  let wonLeads = $derived(directOrders.filter((o) => o.leadOutcome === 'WON'));
  let lostLeads = $derived(directOrders.filter((o) => o.leadOutcome === 'LOST'));

  let marketplaceRevenue = $derived(
    marketplaceOrders.filter((o) => o.status === 'APPROVED' || o.status === 'FULFILLED')
      .reduce((s, o) => s + (Number(o.totalAmount) || 0), 0)
  );
  let directRevenue = $derived(
    wonLeads.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0)
  );
  let totalRevenue = $derived(marketplaceRevenue + directRevenue);
  let mpShare = $derived(totalRevenue > 0 ? marketplaceRevenue / totalRevenue : 0);

  let closeRate = $derived(
    wonLeads.length + lostLeads.length > 0
      ? wonLeads.length / (wonLeads.length + lostLeads.length)
      : 0
  );

  onMount(async () => {
    await loadAll();

    try {
      cleanupStream = api.subscribeToEvents((event: any) => {
        const meta = event.metadata || {};
        const tool = meta.toolName as string | undefined;
        if (!tool || !SALES_TOOLS.has(tool)) return;

        const isWrite = meta.sideEffect && meta.sideEffect !== 'READ';
        const args = meta.arguments ?? {};
        let detail = '';

        if (tool === 'create_sales_order') {
          detail = `${args.channel ?? '?'} · qty ${args.quantity ?? '?'} @ ${money(args.unitPrice)}`;
        } else if (tool === 'close_sales_lead') {
          detail = `lead closed ${args.outcome ?? '?'}${args.lostReason ? ` — ${args.lostReason}` : ''}`;
        } else {
          detail = 'pipeline inspected by agent';
        }

        agentActivity = [
          {
            id: Math.random().toString(36).slice(2),
            time: new Date().toLocaleTimeString(),
            tool,
            detail,
            write: !!isWrite
          },
          ...agentActivity.slice(0, 39)
        ];

        if (isWrite) loadAll();
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

<svelte:head><title>Sales Performance — Autonomous Enterprise</title></svelte:head>

<div class="sales-page">
  <div class="page-header">
    <div>
      <div class="title">Sales Performance</div>
      <p class="subtitle">
        Two revenue streams and rep KPIs computed from real database records. Every order and lead
        closure below was decided and written by the autonomous Sales Agent.
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

  <div class="channel-split">
    <div class="channel-card marketplace">
      <div class="channel-head">
        <span class="channel-icon">🛒</span>
        <div>
          <div class="channel-name">MARKETPLACE</div>
          <div class="channel-sub">Self-service checkout · auto-approved</div>
        </div>
      </div>
      <div class="channel-value">{money(marketplaceRevenue)}</div>
      <div class="channel-metrics">
        <span><b>{marketplaceOrders.length}</b> orders</span>
        <span><b>{pct(mpShare)}</b> of revenue</span>
      </div>
      <div class="share-bar"><div class="share-fill mp" style="width: {mpShare * 100}%"></div></div>
    </div>

    <div class="channel-card direct">
      <div class="channel-head">
        <span class="channel-icon">🤝</span>
        <div>
          <div class="channel-name">DIRECT SALES</div>
          <div class="channel-sub">Rep-assigned leads · closed WON / LOST</div>
        </div>
      </div>
      <div class="channel-value">{money(directRevenue)}</div>
      <div class="channel-metrics">
        <span><b>{directOrders.length}</b> leads</span>
        <span><b>{pct(closeRate)}</b> close rate</span>
      </div>
      <div class="lead-pills">
        <span class="pill won">{wonLeads.length} WON</span>
        <span class="pill pending">{openLeads.length} OPEN</span>
        <span class="pill lost">{lostLeads.length} LOST</span>
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-head">
      <span class="panel-title">SALES REP KPI LEADERBOARD</span>
      <span class="panel-note">score = closing rate ×50 + quota attainment ×35 + speed ×15</span>
    </div>

    {#if kpis.length === 0}
      <div class="empty">No sales reps found. Start the simulator to seed reps and let agents work.</div>
    {:else}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Rep</th><th>Territory</th>
              <th class="num">Leads</th><th class="num">Won</th><th class="num">Lost</th>
              <th class="num">Close Rate</th><th class="num">Revenue</th>
              <th class="num">Quota</th><th class="num">Avg Close</th>
              <th class="num">Score</th><th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {#each kpis as k, i (k.repId)}
              <tr>
                <td class="rank">{i + 1}</td>
                <td class="rep-name">{k.fullName}</td>
                <td class="muted">{k.territory}</td>
                <td class="num">{k.assignedLeads}</td>
                <td class="num won-txt">{k.wonDeals}</td>
                <td class="num lost-txt">{k.lostDeals}</td>
                <td class="num">{pct(k.closingRate)}</td>
                <td class="num">{money(k.revenueClosedUsd)}</td>
                <td class="num">
                  <div class="quota-cell">
                    <span>{pct(k.quotaAttainment)}</span>
                    <div class="quota-bar">
                      <div class="quota-fill" style="width: {Math.min(100, (k.quotaAttainment || 0) * 100)}%"></div>
                    </div>
                  </div>
                </td>
                <td class="num muted">
                  {k.avgClosingTimeMinutes ? `${k.avgClosingTimeMinutes.toFixed(1)}m` : '—'}
                </td>
                <td class="num score">{k.kpiScore?.toFixed(1) ?? '0.0'}</td>
                <td><span class="rating {ratingClass(k.rating)}">{k.rating}</span></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <div class="two-col">
    <div class="panel">
      <div class="panel-head">
        <span class="panel-title">OPEN LEADS AWAITING CLOSURE</span>
        <span class="panel-note">{openLeads.length} pending</span>
      </div>
      {#if openLeads.length === 0}
        <div class="empty">No open leads — agents have closed everything.</div>
      {:else}
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Order</th><th>Rep</th><th class="num">Amount</th><th>Status</th></tr>
            </thead>
            <tbody>
              {#each openLeads.slice(0, 15) as o (o.id)}
                <tr>
                  <td class="mono">{o.orderNumber}</td>
                  <td class="muted mono">{(o.assignedRepId ?? '—').slice(0, 18)}</td>
                  <td class="num">{money(o.totalAmount)}</td>
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
        <span class="panel-title">LIVE SALES AGENT ACTIVITY</span>
        <span class="panel-note">tool calls streamed via SSE</span>
      </div>
      {#if agentActivity.length === 0}
        <div class="empty">Waiting for Sales Agent tool calls. Start the simulator in Virtual Office.</div>
      {:else}
        <div class="activity-list">
          {#each agentActivity as a (a.id)}
            <div class="activity-item" class:is-write={a.write}>
              <span class="act-badge" class:write={a.write}>{a.write ? 'DB WRITE' : 'READ'}</span>
              <div class="act-body">
                <code class="act-tool">{a.tool}()</code>
                <span class="act-detail">{a.detail}</span>
              </div>
              <span class="act-time">{a.time}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .sales-page { display: flex; flex-direction: column; gap: 1.25rem; }

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

  .channel-split { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; }
  .channel-card {
    background: var(--bg-card); border: 1px solid var(--border-color);
    border-radius: 10px; padding: 1.1rem 1.25rem;
    display: flex; flex-direction: column; gap: 0.6rem;
  }
  .channel-card.marketplace { border-left: 3px solid var(--accent-blue); }
  .channel-card.direct { border-left: 3px solid var(--accent-amber, #f59e0b); }
  .channel-head { display: flex; align-items: center; gap: 0.7rem; }
  .channel-icon { font-size: 1.5rem; }
  .channel-name {
    font-size: 0.75rem; font-weight: 800; letter-spacing: 0.08em;
    color: var(--text-primary); font-family: var(--font-mono);
  }
  .channel-sub { font-size: 0.72rem; color: var(--text-muted); margin-top: 0.1rem; }
  .channel-value {
    font-size: 1.9rem; font-weight: 700; color: var(--text-primary);
    font-family: var(--font-mono); line-height: 1;
  }
  .channel-metrics { display: flex; gap: 1.1rem; font-size: 0.76rem; color: var(--text-secondary); }
  .channel-metrics b { color: var(--text-primary); font-family: var(--font-mono); }
  .share-bar { height: 5px; background: var(--bg-hover, rgba(148,163,184,0.15)); border-radius: 3px; overflow: hidden; }
  .share-fill { height: 100%; border-radius: 3px; transition: width 0.6s ease; }
  .share-fill.mp { background: var(--accent-blue); }

  .lead-pills { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .pill {
    font-family: var(--font-mono); font-size: 0.66rem; font-weight: 700;
    padding: 0.2rem 0.45rem; border-radius: 4px;
  }
  .pill.won { background: rgba(16,185,129,0.16); color: var(--accent-emerald); }
  .pill.pending { background: rgba(148,163,184,0.16); color: var(--text-secondary); }
  .pill.lost { background: rgba(239,68,68,0.16); color: #f87171; }

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
    white-space: nowrap;
  }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: rgba(148,163,184,0.05); }
  .num { text-align: right; font-family: var(--font-mono); }
  th.num { text-align: right; }
  .mono { font-family: var(--font-mono); font-size: 0.72rem; }
  .muted { color: var(--text-muted); }
  .rank { color: var(--text-muted); font-family: var(--font-mono); width: 2rem; }
  .rep-name { color: var(--text-primary); font-weight: 600; }
  .won-txt { color: var(--accent-emerald); }
  .lost-txt { color: #f87171; }
  .score { color: var(--text-primary); font-weight: 700; }

  .quota-cell { display: flex; flex-direction: column; align-items: flex-end; gap: 0.2rem; }
  .quota-bar {
    width: 54px; height: 4px; border-radius: 2px;
    background: rgba(148,163,184,0.18); overflow: hidden;
  }
  .quota-fill { height: 100%; background: var(--accent-blue); border-radius: 2px; }

  .rating {
    display: inline-block; min-width: 1.35rem; text-align: center;
    font-family: var(--font-mono); font-size: 0.7rem; font-weight: 800;
    padding: 0.15rem 0.35rem; border-radius: 4px;
  }
  .rating-a { background: rgba(16,185,129,0.18); color: var(--accent-emerald); }
  .rating-b { background: rgba(59,130,246,0.18); color: var(--accent-blue); }
  .rating-c { background: rgba(245,158,11,0.18); color: #fbbf24; }
  .rating-d { background: rgba(239,68,68,0.16); color: #f87171; }

  .status-pill {
    font-family: var(--font-mono); font-size: 0.64rem; font-weight: 700;
    padding: 0.15rem 0.4rem; border-radius: 4px;
    background: rgba(148,163,184,0.15); color: var(--text-secondary);
  }

  .activity-list { max-height: 320px; overflow-y: auto; }
  .activity-item {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 0.5rem 0.9rem; border-bottom: 1px solid var(--border-color);
  }
  .activity-item:last-child { border-bottom: none; }
  .activity-item.is-write { background: rgba(16,185,129,0.06); }
  .act-badge {
    font-family: var(--font-mono); font-size: 0.58rem; font-weight: 800;
    padding: 0.18rem 0.35rem; border-radius: 3px; flex-shrink: 0;
    background: rgba(59,130,246,0.16); color: var(--accent-blue);
  }
  .act-badge.write { background: rgba(16,185,129,0.18); color: var(--accent-emerald); }
  .act-body { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; flex: 1; }
  .act-tool { font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-primary); }
  .act-detail { font-size: 0.7rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; }
  .act-time {
    font-family: var(--font-mono); font-size: 0.62rem;
    color: var(--text-muted); flex-shrink: 0;
  }
</style>
