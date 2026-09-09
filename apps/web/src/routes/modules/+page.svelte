<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { api } from '$lib/api';

  type ModuleKey = 'sales' | 'inventory' | 'infrastructure' | 'hris';

  let activeModule = $state<ModuleKey>('sales');
  let autoRefresh = $state(true);
  let lastSync = $state('--:--:--');
  let loading = $state(false);
  let pollTimer: any = null;
  let cleanupStream: (() => void) | null = null;

  let salesOrders = $state<any[]>([]);
  let customers = $state<any[]>([]);
  let products = $state<any[]>([]);
  let warehouses = $state<any[]>([]);
  let reservations = $state<any[]>([]);
  let movements = $state<any[]>([]);
  let clusterSnapshot = $state<any>(null);
  let scalingEvents = $state<any[]>([]);
  let employees = $state<any[]>([]);
  let departments = $state<any[]>([]);

  let writeLog = $state<
    Array<{ id: string; time: string; module: string; action: string; detail: string; persisted: boolean }>
  >([]);

  let prevCounts = $state<Record<string, number>>({});
  let flashKeys = $state<Record<string, boolean>>({});

  const MODULES: Array<{ key: ModuleKey; label: string; icon: string; desc: string }> = [
    { key: 'sales', label: 'Sales', icon: '🛍️', desc: 'Customers & sales orders written by the Sales Agent' },
    { key: 'inventory', label: 'Inventory', icon: '📦', desc: 'Products, stock reservations & movement ledger' },
    { key: 'infrastructure', label: 'Infrastructure', icon: '🖥️', desc: 'Kubernetes cluster state & scaling events' },
    { key: 'hris', label: 'HRIS', icon: '👥', desc: 'Departments & workforce capacity records' }
  ];

  async function loadAll() {
    loading = true;
    try {
      const [
        ordersRes, custRes, prodRes, whRes, resvRes, moveRes,
        clusterRes, scaleRes, empRes, deptRes
      ] = await Promise.all([
        api.listSalesOrders().catch(() => ({ data: [] })),
        api.listCustomers().catch(() => ({ data: [] })),
        api.listProducts().catch(() => ({ data: [] })),
        api.listWarehouses().catch(() => ({ data: [] })),
        api.listStockReservations().catch(() => ({ data: [] })),
        api.listStockMovements().catch(() => ({ data: [] })),
        api.getClusterSnapshot().catch(() => ({ data: null })),
        api.listScalingEvents().catch(() => ({ data: [] })),
        api.listEmployees().catch(() => ({ data: [] })),
        api.listDepartments().catch(() => ({ data: [] }))
      ]);

      salesOrders = (ordersRes as any).data ?? [];
      customers = (custRes as any).data ?? [];
      products = (prodRes as any).data ?? [];
      warehouses = (whRes as any).data ?? [];
      reservations = (resvRes as any).data ?? [];
      movements = (moveRes as any).data ?? [];
      clusterSnapshot = (clusterRes as any).data ?? null;
      scalingEvents = (scaleRes as any).data ?? [];
      employees = (empRes as any).data ?? [];
      departments = (deptRes as any).data ?? [];

      detectGrowth();
      lastSync = new Date().toLocaleTimeString();
    } finally {
      loading = false;
    }
  }

  function detectGrowth() {
    const current: Record<string, number> = {
      salesOrders: salesOrders.length,
      customers: customers.length,
      products: products.length,
      reservations: reservations.length,
      movements: movements.length,
      scalingEvents: scalingEvents.length
    };

    for (const [key, value] of Object.entries(current)) {
      if (prevCounts[key] !== undefined && value > prevCounts[key]) {
        flashKeys[key] = true;
        setTimeout(() => { flashKeys[key] = false; }, 1600);
      }
    }
    prevCounts = current;
  }

  onMount(() => {
    loadAll();

    pollTimer = setInterval(() => {
      if (autoRefresh) loadAll();
    }, 3000);

    try {
      cleanupStream = api.subscribeToEvents((event: any) => {
        const meta = event?.metadata || {};
        if (!meta.module) return;

        writeLog = [
          {
            id: Math.random().toString(36).slice(2),
            time: new Date().toLocaleTimeString(),
            module: String(meta.module),
            action: event.action,
            detail: buildDetail(meta),
            persisted: Boolean(meta.persisted)
          },
          ...writeLog.slice(0, 79)
        ];
      });
    } catch (e) {}
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
    if (cleanupStream) cleanupStream();
  });

  function buildDetail(meta: any): string {
    if (meta.orderNumber) return `${meta.orderNumber} · ${meta.quantity ?? 0} qty · $${Number(meta.amount ?? 0).toFixed(2)}`;
    if (meta.sku) return `${meta.sku} · reserve ${meta.quantity ?? 0}${meta.availableQty !== undefined ? ` · avail ${meta.availableQty}` : ''}`;
    return JSON.stringify(meta).slice(0, 90);
  }

  function fmt(value: any): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
  }

  function shortId(id: string): string {
    return id ? `${id.slice(0, 8)}…` : '—';
  }

  function timeOf(iso: string): string {
    try { return new Date(iso).toLocaleTimeString(); } catch { return '—'; }
  }

  let persistedWrites = $derived(writeLog.filter((w) => w.persisted).length);
</script>

<svelte:head>
  <title>Business Modules — Live Data Verification</title>
</svelte:head>

<div class="modules-page">
  <div class="page-header">
    <div>
      <h2 class="title">Business Module Explorer</h2>
      <p class="subtitle">
        Proof that the Virtual Office writes real records — every row below comes straight from the module database,
        not from the animation layer.
      </p>
    </div>

    <div class="header-controls">
      <div class="sync-chip" class:live={autoRefresh}>
        <span class="sync-dot"></span>
        {autoRefresh ? 'AUTO-REFRESH 3s' : 'PAUSED'} · {lastSync}
      </div>
      <button class="ctrl-btn" onclick={() => (autoRefresh = !autoRefresh)}>
        {autoRefresh ? '⏸ Pause' : '▶ Resume'}
      </button>
      <button class="ctrl-btn primary" onclick={loadAll} disabled={loading}>
        {loading ? 'Loading…' : '↻ Refresh Now'}
      </button>
    </div>
  </div>

  <!-- Global proof counters -->
  <div class="proof-grid">
    <div class="proof-card" class:flash={flashKeys.salesOrders}>
      <span class="proof-label">SALES ORDERS</span>
      <span class="proof-value">{salesOrders.length}</span>
      <span class="proof-note">persisted rows</span>
    </div>
    <div class="proof-card" class:flash={flashKeys.reservations}>
      <span class="proof-label">STOCK RESERVATIONS</span>
      <span class="proof-value">{reservations.length}</span>
      <span class="proof-note">warehouse locks</span>
    </div>
    <div class="proof-card" class:flash={flashKeys.movements}>
      <span class="proof-label">STOCK MOVEMENTS</span>
      <span class="proof-value">{movements.length}</span>
      <span class="proof-note">ledger entries</span>
    </div>
    <div class="proof-card">
      <span class="proof-label">CONFIRMED DB WRITES</span>
      <span class="proof-value accent">{persistedWrites}</span>
      <span class="proof-note">of {writeLog.length} events</span>
    </div>
  </div>

  <!-- Module tabs -->
  <div class="tabs-row">
    {#each MODULES as m}
      <button class="tab-btn" class:active={activeModule === m.key} onclick={() => (activeModule = m.key)}>
        <span class="tab-icon">{m.icon}</span>
        {m.label}
      </button>
    {/each}
  </div>

  <p class="module-desc">{MODULES.find((m) => m.key === activeModule)?.desc}</p>

  <div class="content-grid">
    <div class="main-col">
      {#if activeModule === 'sales'}
        <div class="card">
          <div class="card-head">
            <h3>Sales Orders</h3>
            <span class="count-badge" class:flash={flashKeys.salesOrders}>{salesOrders.length} rows</span>
          </div>
          <div class="table-wrap">
            {#if salesOrders.length === 0}
              <div class="empty">No orders yet. Start the simulator in the Virtual Office to generate real orders.</div>
            {:else}
              <table>
                <thead>
                  <tr><th>Order No.</th><th>Status</th><th>Items</th><th>Total</th><th>Created</th></tr>
                </thead>
                <tbody>
                  {#each salesOrders.slice(0, 30) as o}
                    <tr>
                      <td class="mono">{fmt(o.orderNumber)}</td>
                      <td><span class="pill">{fmt(o.status)}</span></td>
                      <td>{o.items?.length ?? 0}</td>
                      <td class="num">${Number(o.totalAmount ?? 0).toFixed(2)}</td>
                      <td class="muted">{timeOf(o.createdAt)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h3>Customers</h3>
            <span class="count-badge">{customers.length} rows</span>
          </div>
          <div class="table-wrap">
            {#if customers.length === 0}
              <div class="empty">No customers registered yet.</div>
            {:else}
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>ID</th></tr></thead>
                <tbody>
                  {#each customers.slice(0, 15) as c}
                    <tr>
                      <td>{fmt(c.name)}</td>
                      <td class="muted">{fmt(c.email)}</td>
                      <td class="mono muted">{shortId(c.id)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>
        </div>

      {:else if activeModule === 'inventory'}
        <div class="card">
          <div class="card-head">
            <h3>Stock Reservations</h3>
            <span class="count-badge" class:flash={flashKeys.reservations}>{reservations.length} rows</span>
          </div>
          <div class="table-wrap">
            {#if reservations.length === 0}
              <div class="empty">No reservations yet.</div>
            {:else}
              <table>
                <thead><tr><th>Reservation</th><th>Status</th><th>Qty</th><th>Product</th></tr></thead>
                <tbody>
                  {#each reservations.slice(0, 30) as r}
                    <tr>
                      <td class="mono">{shortId(r.id)}</td>
                      <td><span class="pill">{fmt(r.status)}</span></td>
                      <td class="num">{fmt(r.quantity)}</td>
                      <td class="mono muted">{shortId(r.productId)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h3>Stock Movement Ledger</h3>
            <span class="count-badge" class:flash={flashKeys.movements}>{movements.length} rows</span>
          </div>
          <div class="table-wrap">
            {#if movements.length === 0}
              <div class="empty">No stock movements recorded.</div>
            {:else}
              <table>
                <thead><tr><th>Type</th><th>Qty</th><th>Product</th><th>Time</th></tr></thead>
                <tbody>
                  {#each movements.slice(0, 25) as mv}
                    <tr>
                      <td><span class="pill">{fmt(mv.movementType ?? mv.type)}</span></td>
                      <td class="num">{fmt(mv.quantity)}</td>
                      <td class="mono muted">{shortId(mv.productId)}</td>
                      <td class="muted">{timeOf(mv.createdAt)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h3>Product Catalog</h3>
            <span class="count-badge">{products.length} rows</span>
          </div>
          <div class="table-wrap">
            {#if products.length === 0}
              <div class="empty">No products.</div>
            {:else}
              <table>
                <thead><tr><th>SKU</th><th>Name</th><th>Price</th></tr></thead>
                <tbody>
                  {#each products.slice(0, 15) as p}
                    <tr>
                      <td class="mono">{fmt(p.sku)}</td>
                      <td>{fmt(p.name)}</td>
                      <td class="num">${Number(p.price ?? 0).toFixed(2)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>
        </div>

      {:else if activeModule === 'infrastructure'}
        <div class="card">
          <div class="card-head">
            <h3>Kubernetes Cluster Snapshot</h3>
            <span class="count-badge">live</span>
          </div>
          {#if clusterSnapshot}
            <div class="kv-grid">
              {#each Object.entries(clusterSnapshot) as [k, v]}
                <div class="kv-item">
                  <span class="kv-key">{k}</span>
                  <span class="kv-val mono">{typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : fmt(v)}</span>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty">Cluster snapshot unavailable.</div>
          {/if}
        </div>

        <div class="card">
          <div class="card-head">
            <h3>Scaling Events</h3>
            <span class="count-badge" class:flash={flashKeys.scalingEvents}>{scalingEvents.length} rows</span>
          </div>
          <div class="table-wrap">
            {#if scalingEvents.length === 0}
              <div class="empty">No scaling events recorded.</div>
            {:else}
              <table>
                <thead><tr><th>Event</th><th>Status</th><th>Replicas</th><th>Time</th></tr></thead>
                <tbody>
                  {#each scalingEvents.slice(0, 25) as ev}
                    <tr>
                      <td class="mono">{shortId(ev.id)}</td>
                      <td><span class="pill">{fmt(ev.status)}</span></td>
                      <td class="num">{fmt(ev.targetReplicas ?? ev.replicas)}</td>
                      <td class="muted">{timeOf(ev.createdAt)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>
        </div>

      {:else}
        <div class="card">
          <div class="card-head">
            <h3>Departments</h3>
            <span class="count-badge">{departments.length} rows</span>
          </div>
          <div class="table-wrap">
            {#if departments.length === 0}
              <div class="empty">No departments.</div>
            {:else}
              <table>
                <thead><tr><th>Name</th><th>Code</th><th>ID</th></tr></thead>
                <tbody>
                  {#each departments.slice(0, 20) as d}
                    <tr>
                      <td>{fmt(d.name)}</td>
                      <td class="mono">{fmt(d.code)}</td>
                      <td class="mono muted">{shortId(d.id)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h3>Employees</h3>
            <span class="count-badge">{employees.length} rows</span>
          </div>
          <div class="table-wrap">
            {#if employees.length === 0}
              <div class="empty">No employees.</div>
            {:else}
              <table>
                <thead><tr><th>Name</th><th>Position</th><th>Status</th></tr></thead>
                <tbody>
                  {#each employees.slice(0, 20) as e}
                    <tr>
                      <td>{fmt(e.fullName ?? e.name)}</td>
                      <td class="muted">{fmt(e.position)}</td>
                      <td><span class="pill">{fmt(e.status)}</span></td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- Live write audit trail -->
    <aside class="side-col">
      <div class="card sticky">
        <div class="card-head">
          <h3>Live DB Write Trail</h3>
          <span class="count-badge">{writeLog.length}</span>
        </div>
        <p class="trail-hint">
          Each entry is an agent action streamed over Redis. <strong>PERSISTED</strong> means the
          module service committed a real row to the database.
        </p>
        <div class="trail-list">
          {#if writeLog.length === 0}
            <div class="empty small">Waiting for agent activity…</div>
          {:else}
            {#each writeLog as w (w.id)}
              <div class="trail-item" class:ok={w.persisted}>
                <div class="trail-top">
                  <span class="trail-module">{w.module}</span>
                  <span class="trail-time">{w.time}</span>
                </div>
                <div class="trail-action">{w.action}</div>
                <div class="trail-detail">{w.detail}</div>
                <span class="trail-flag" class:ok={w.persisted}>
                  {w.persisted ? '✓ PERSISTED TO DB' : '○ EVENT ONLY'}
                </span>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </aside>
  </div>
</div>

<style>
  .modules-page { display: flex; flex-direction: column; gap: 1.25rem; }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .title { font-size: 1.35rem; font-weight: 700; color: var(--text-primary); }
  .subtitle { font-size: 0.85rem; color: var(--text-secondary); max-width: 640px; margin-top: 0.25rem; line-height: 1.5; }

  .header-controls { display: flex; align-items: center; gap: 0.5rem; }

  .sync-chip {
    display: flex; align-items: center; gap: 0.4rem;
    background: var(--bg-card); border: 1px solid var(--border-color);
    padding: 0.35rem 0.65rem; border-radius: 6px;
    font-size: 0.72rem; font-family: var(--font-mono); color: var(--text-secondary);
  }
  .sync-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-muted); }
  .sync-chip.live .sync-dot { background: var(--accent-emerald); box-shadow: 0 0 7px var(--accent-emerald); animation: pulse 1.4s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

  .ctrl-btn {
    background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-secondary);
    padding: 0.4rem 0.75rem; border-radius: 6px; font-size: 0.78rem; cursor: pointer;
  }
  .ctrl-btn.primary { background: var(--accent-blue); border-color: var(--accent-blue); color: #fff; font-weight: 600; }
  .ctrl-btn:hover { filter: brightness(1.15); }

  .proof-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; }

  .proof-card {
    background: var(--bg-card); border: 1px solid var(--border-color);
    border-radius: 8px; padding: 0.85rem 1rem;
    display: flex; flex-direction: column; gap: 0.15rem;
    transition: border-color 0.3s, box-shadow 0.3s;
  }
  .proof-card.flash { border-color: var(--accent-emerald); box-shadow: 0 0 16px rgba(16,185,129,0.35); }
  .proof-label { font-size: 0.64rem; font-weight: 700; letter-spacing: 0.07em; color: var(--text-muted); }
  .proof-value { font-size: 1.6rem; font-weight: 700; color: var(--text-primary); font-family: var(--font-mono); }
  .proof-value.accent { color: var(--accent-emerald); }
  .proof-note { font-size: 0.7rem; color: var(--text-muted); }

  .tabs-row { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .tab-btn {
    background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-secondary);
    padding: 0.5rem 0.9rem; border-radius: 6px; font-size: 0.82rem; cursor: pointer;
    display: flex; align-items: center; gap: 0.4rem;
  }
  .tab-btn.active { background: rgba(59,130,246,0.15); border-color: var(--accent-blue); color: var(--accent-blue); font-weight: 600; }
  .tab-icon { font-size: 0.95rem; }

  .module-desc { font-size: 0.8rem; color: var(--text-muted); margin-top: -0.5rem; }

  .content-grid { display: grid; grid-template-columns: 1fr 340px; gap: 1rem; align-items: start; }
  @media (max-width: 1100px) { .content-grid { grid-template-columns: 1fr; } }

  .main-col { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
  .side-col { min-width: 0; }

  .card {
    background: var(--bg-card); border: 1px solid var(--border-color);
    border-radius: 8px; padding: 1rem;
  }
  .card.sticky { position: sticky; top: 1rem; }

  .card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
  .card-head h3 { font-size: 0.92rem; font-weight: 600; color: var(--text-primary); }

  .count-badge {
    font-size: 0.68rem; font-family: var(--font-mono);
    background: var(--bg-secondary); border: 1px solid var(--border-color);
    color: var(--text-muted); padding: 0.15rem 0.45rem; border-radius: 4px;
    transition: all 0.3s;
  }
  .count-badge.flash { background: rgba(16,185,129,0.2); border-color: var(--accent-emerald); color: #34d399; }

  .table-wrap { overflow-x: auto; max-height: 340px; overflow-y: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
  thead th {
    text-align: left; padding: 0.4rem 0.5rem; font-size: 0.66rem;
    letter-spacing: 0.05em; color: var(--text-muted); font-weight: 700;
    border-bottom: 1px solid var(--border-color); position: sticky; top: 0; background: var(--bg-card);
  }
  tbody td { padding: 0.45rem 0.5rem; border-bottom: 1px solid rgba(36,43,61,0.5); color: var(--text-primary); }
  tbody tr:hover { background: var(--bg-card-hover); }

  .mono { font-family: var(--font-mono); font-size: 0.74rem; }
  .muted { color: var(--text-muted); }
  .num { font-family: var(--font-mono); text-align: right; }

  .pill {
    font-size: 0.66rem; background: rgba(59,130,246,0.15);
    color: #60a5fa; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 600;
  }

  .empty {
    padding: 1.25rem 1rem; text-align: center; font-size: 0.8rem;
    color: var(--text-muted); background: var(--bg-secondary);
    border: 1px dashed var(--border-color); border-radius: 6px; line-height: 1.5;
  }
  .empty.small { padding: 0.85rem; font-size: 0.75rem; }

  .kv-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem; }
  .kv-item {
    background: var(--bg-secondary); border: 1px solid var(--border-color);
    border-radius: 6px; padding: 0.5rem 0.65rem; display: flex; flex-direction: column; gap: 0.15rem;
  }
  .kv-key { font-size: 0.66rem; color: var(--text-muted); font-weight: 700; }
  .kv-val { font-size: 0.78rem; color: var(--text-primary); word-break: break-all; }

  .trail-hint { font-size: 0.72rem; color: var(--text-muted); line-height: 1.45; margin-bottom: 0.6rem; }
  .trail-list { display: flex; flex-direction: column; gap: 0.45rem; max-height: 480px; overflow-y: auto; }

  .trail-item {
    background: var(--bg-secondary); border-left: 2px solid var(--border-color);
    border-radius: 0 5px 5px 0; padding: 0.45rem 0.6rem;
  }
  .trail-item.ok { border-left-color: var(--accent-emerald); }

  .trail-top { display: flex; justify-content: space-between; font-size: 0.66rem; }
  .trail-module { color: #60a5fa; font-weight: 700; text-transform: uppercase; }
  .trail-time { color: var(--text-muted); font-family: var(--font-mono); }
  .trail-action { font-size: 0.72rem; font-family: var(--font-mono); color: var(--text-primary); margin-top: 0.15rem; }
  .trail-detail { font-size: 0.72rem; color: var(--text-secondary); margin: 0.15rem 0; word-break: break-word; }

  .trail-flag { font-size: 0.62rem; font-weight: 700; color: var(--text-muted); }
  .trail-flag.ok { color: var(--accent-emerald); }
</style>
