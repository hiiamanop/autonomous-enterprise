<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    api,
    type AgentUsageBreakdown,
    type AiBudgetStatus,
    type SetBudgetDto,
    type TenantAiBudget
  } from '$lib/api';

  let budgetStatus = $state<AiBudgetStatus>({
    tenantId: 'tenant-corp',
    dailyUsedUsd: 0,
    dailyRemainingUsd: 0,
    monthlyUsedUsd: 0,
    monthlyRemainingUsd: 0,
    isDailyExceeded: false,
    isMonthlyExceeded: false
  });

  let budgetConfig = $state<SetBudgetDto>({
    dailyBudgetUsd: 50.0,
    monthlyBudgetUsd: 1500.0,
    perTransactionBudgetUsd: 2.0,
    perAgentDailyBudgetUsd: 15.0
  });

  let agentSpend = $state<AgentUsageBreakdown[]>([]);
  let liveEvents = $state<Array<{ id: string; time: string; agent: string; tokens: number; cost: number }>>([]);
  let cleanupStream: (() => void) | null = null;
  let pollTimer: any = null;
  let lastSyncedAt = $state<string>('--:--:--');

  let loading = $state(false);
  let saving = $state(false);
  let statusMessage = $state<{ text: string; type: 'success' | 'error' } | null>(null);

  async function loadBudget() {
    loading = true;
    try {
      const [statusRes, usageRes] = await Promise.all([
        api.getBudgetStatus(),
        api.getAgentUsageBreakdown()
      ]);

      if (statusRes.success && statusRes.data) {
        budgetStatus = statusRes.data;
      }

      if (usageRes.success && Array.isArray(usageRes.data)) {
        agentSpend = usageRes.data;
      }

      lastSyncedAt = new Date().toLocaleTimeString();
    } catch (err) {
      console.error(err);
    } finally {
      loading = false;
    }
  }

  async function handleSaveBudget(e: Event) {
    e.preventDefault();
    saving = true;
    try {
      const res = await api.configureBudget(budgetConfig);
      if (res.success) {
        statusMessage = { text: 'Cognitive budget constraints updated successfully', type: 'success' };
      } else {
        statusMessage = { text: 'Budget updated locally', type: 'success' };
      }
      // Re-calculate mock status based on new limits
      const dailyTotal = (budgetConfig.dailyBudgetUsd || 50.0);
      const monthlyTotal = (budgetConfig.monthlyBudgetUsd || 1500.0);
      budgetStatus.dailyRemainingUsd = Math.max(0, dailyTotal - budgetStatus.dailyUsedUsd);
      budgetStatus.monthlyRemainingUsd = Math.max(0, monthlyTotal - budgetStatus.monthlyUsedUsd);
      budgetStatus.isDailyExceeded = budgetStatus.dailyUsedUsd > dailyTotal;
      budgetStatus.isMonthlyExceeded = budgetStatus.monthlyUsedUsd > monthlyTotal;
    } catch (err: any) {
      statusMessage = { text: err?.message || 'Failed to update budget', type: 'error' };
    } finally {
      saving = false;
      setTimeout(() => { statusMessage = null; }, 4000);
    }
  }

  onMount(() => {
    loadBudget();

    pollTimer = setInterval(() => {
      loadBudget();
    }, 3000);

    try {
      cleanupStream = api.subscribeToEvents((event: any) => {
        const meta = event?.metadata || {};
        const tokens = Number(meta.tokens ?? meta.totalTokens ?? 0);
        if (!tokens) return;

        liveEvents = [
          {
            id: Math.random().toString(36).slice(2),
            time: new Date().toLocaleTimeString(),
            agent: meta.actorName || event?.actor?.id || 'system',
            tokens,
            cost: Number(meta.estimatedCostUsd ?? 0)
          },
          ...liveEvents.slice(0, 49)
        ];
      });
    } catch (e) {}
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
    if (cleanupStream) cleanupStream();
  });

  let dailyTotal = $derived(budgetStatus.dailyUsedUsd + budgetStatus.dailyRemainingUsd);
  let dailyPct = $derived(dailyTotal > 0 ? Math.min(100, Math.round((budgetStatus.dailyUsedUsd / dailyTotal) * 100)) : 0);

  let monthlyTotal = $derived(budgetStatus.monthlyUsedUsd + budgetStatus.monthlyRemainingUsd);
  let monthlyPct = $derived(monthlyTotal > 0 ? Math.min(100, Math.round((budgetStatus.monthlyUsedUsd / monthlyTotal) * 100)) : 0);
</script>

<div class="finops-page">
  <!-- Header -->
  <div class="page-header">
    <div>
      <h2 class="title">AI FinOps & Cognitive Budget Meter</h2>
      <p class="subtitle">Multi-tenant AI token expenditure tracking, circuit breaker limits, and granular agent budget governance.</p>
    </div>
    <button class="btn btn-secondary" onclick={loadBudget} disabled={loading}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path>
      </svg>
      Refresh
    </button>
  </div>

  {#if statusMessage}
    <div class="alert" class:alert-success={statusMessage.type === 'success'} class:alert-error={statusMessage.type === 'error'}>
      {statusMessage.text}
    </div>
  {/if}

  <!-- Budget Gauges Grid -->
  <div class="gauges-grid">
    <!-- Daily Budget Card -->
    <div class="card gauge-card" class:exceeded={budgetStatus.isDailyExceeded}>
      <div class="gauge-header">
        <span class="gauge-tag">Daily Allocation</span>
        <span class="status-pill" class:pill-danger={budgetStatus.isDailyExceeded} class:pill-safe={!budgetStatus.isDailyExceeded}>
          {budgetStatus.isDailyExceeded ? 'EXCEEDED' : 'WITHIN LIMIT'}
        </span>
      </div>

      <div class="gauge-body">
        <div class="gauge-numbers">
          <span class="used-val">${budgetStatus.dailyUsedUsd.toFixed(2)}</span>
          <span class="total-val">/ ${dailyTotal.toFixed(2)} USD</span>
        </div>

        <div class="progress-bar-container">
          <div
            class="progress-bar-fill"
            class:fill-warning={dailyPct > 75}
            class:fill-danger={dailyPct >= 100 || budgetStatus.isDailyExceeded}
            style="width: {dailyPct}%"
          ></div>
        </div>

        <div class="gauge-footer">
          <span>{dailyPct}% consumed</span>
          <span>${budgetStatus.dailyRemainingUsd.toFixed(2)} remaining</span>
        </div>
      </div>
    </div>

    <!-- Monthly Budget Card -->
    <div class="card gauge-card" class:exceeded={budgetStatus.isMonthlyExceeded}>
      <div class="gauge-header">
        <span class="gauge-tag">Monthly Allocation</span>
        <span class="status-pill" class:pill-danger={budgetStatus.isMonthlyExceeded} class:pill-safe={!budgetStatus.isMonthlyExceeded}>
          {budgetStatus.isMonthlyExceeded ? 'EXCEEDED' : 'WITHIN LIMIT'}
        </span>
      </div>

      <div class="gauge-body">
        <div class="gauge-numbers">
          <span class="used-val">${budgetStatus.monthlyUsedUsd.toFixed(2)}</span>
          <span class="total-val">/ ${monthlyTotal.toFixed(2)} USD</span>
        </div>

        <div class="progress-bar-container">
          <div
            class="progress-bar-fill"
            class:fill-warning={monthlyPct > 75}
            class:fill-danger={monthlyPct >= 100 || budgetStatus.isMonthlyExceeded}
            style="width: {monthlyPct}%"
          ></div>
        </div>

        <div class="gauge-footer">
          <span>{monthlyPct}% consumed</span>
          <span>${budgetStatus.monthlyRemainingUsd.toFixed(2)} remaining</span>
        </div>
      </div>
    </div>
  </div>

  <div class="grid-2-col">
    <!-- Per-Agent Spend Breakdown -->
    <div class="card">
      <div class="card-title-row">
        <h3 class="card-title">Per-Agent Daily Consumption</h3>
        <span class="badge badge-info">
          <span class="live-dot"></span>
          LIVE &bull; {agentSpend.length} Agents &bull; {lastSyncedAt}
        </span>
      </div>

      <div class="agent-spend-list">
        {#if agentSpend.length === 0}
          <div class="empty-usage-state">
            No AI usage recorded today. Start the Virtual Office simulator to generate live LLM consumption.
          </div>
        {:else}
          {#each agentSpend as item}
            {@const pct = item.dailyLimit > 0 ? Math.min(100, (item.dailySpent / item.dailyLimit) * 100) : 0}
            <div class="agent-spend-item">
              <div class="spend-info-row">
                <div>
                  <span class="agent-item-name">{item.agentName}</span>
                  <span class="agent-item-stats">
                    {item.tokens.toLocaleString()} tokens &bull; {item.calls} calls &bull; {item.avgLatencyMs}ms avg
                  </span>
                </div>
                <div class="spend-amount">
                  <span class="spend-val">${item.dailySpent.toFixed(4)}</span>
                  <span class="limit-val">/ ${item.dailyLimit.toFixed(2)}</span>
                </div>
              </div>
              <div class="track-bar">
                <div class="fill-bar" style="width: {pct}%"></div>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <div class="live-token-feed">
        <div class="feed-head">
          <span class="feed-title">LIVE TOKEN METERING STREAM</span>
          <span class="feed-count">{liveEvents.length} events</span>
        </div>
        <div class="feed-body">
          {#if liveEvents.length === 0}
            <div class="feed-idle">Waiting for live AI inference events&hellip;</div>
          {:else}
            {#each liveEvents as ev (ev.id)}
              <div class="feed-row">
                <span class="f-time">[{ev.time}]</span>
                <span class="f-agent">{ev.agent}</span>
                <span class="f-tokens">{ev.tokens} tok</span>
                <span class="f-cost">${ev.cost.toFixed(5)}</span>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>

    <!-- Budget Configuration Form -->
    <div class="card">
      <div class="card-title-row">
        <h3 class="card-title">Configure Budget Policy</h3>
        <span class="badge badge-warning">Enforced at Gateway</span>
      </div>

      <form onsubmit={handleSaveBudget} class="config-form">
        <div class="form-group">
          <label for="daily-budget">Daily Budget Limit (USD)</label>
          <input id="daily-budget" type="number" step="1" bind:value={budgetConfig.dailyBudgetUsd} required />
          <span class="hint">Hard stop triggered when daily consumption reaches 100%</span>
        </div>

        <div class="form-group">
          <label for="monthly-budget">Monthly Budget Limit (USD)</label>
          <input id="monthly-budget" type="number" step="10" bind:value={budgetConfig.monthlyBudgetUsd} required />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="per-tx-budget">Per-Transaction Max (USD)</label>
            <input id="per-tx-budget" type="number" step="0.1" bind:value={budgetConfig.perTransactionBudgetUsd} />
          </div>
          <div class="form-group">
            <label for="per-agent-budget">Per-Agent Daily Max (USD)</label>
            <input id="per-agent-budget" type="number" step="1" bind:value={budgetConfig.perAgentDailyBudgetUsd} />
          </div>
        </div>

        <button type="submit" class="btn btn-primary" disabled={saving}>
          {saving ? 'Saving Policy...' : 'Update Budget Rules'}
        </button>
      </form>
    </div>
  </div>
</div>

<style>
  .finops-page {
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title {
    font-size: 1.4rem;
    font-weight: 700;
  }

  .subtitle {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }

  .btn svg { width: 16px; height: 16px; }

  .btn-primary { background: #2563eb; color: white; }
  .btn-primary:hover { background: #1d4ed8; }

  .btn-secondary {
    background: var(--bg-card);
    border-color: var(--border-color);
    color: var(--text-primary);
  }

  .gauges-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    gap: 1.25rem;
  }

  .card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 1.5rem;
    box-shadow: var(--shadow-sm);
  }

  .gauge-card {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .gauge-card.exceeded {
    border-color: var(--accent-rose);
  }

  .gauge-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .gauge-tag {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .status-pill {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
  }

  .pill-safe { background: var(--accent-emerald-subtle); color: var(--accent-emerald); border: 1px solid var(--accent-emerald-border); }
  .pill-danger { background: var(--accent-rose-subtle); color: var(--accent-rose); border: 1px solid var(--accent-rose-border); }

  .gauge-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .gauge-numbers {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .used-val {
    font-size: 2.2rem;
    font-weight: 800;
    color: var(--text-primary);
    font-family: var(--font-mono);
  }

  .total-val {
    font-size: 1.1rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .progress-bar-container {
    height: 10px;
    background: var(--border-color);
    border-radius: 5px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #06b6d4);
    border-radius: 5px;
    transition: width 0.3s ease;
  }

  .progress-bar-fill.fill-warning { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
  .progress-bar-fill.fill-danger { background: linear-gradient(90deg, #f43f5e, #e11d48); }

  .gauge-footer {
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
    color: var(--text-secondary);
  }

  .grid-2-col {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
    gap: 1.25rem;
  }

  .card-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
  }

  .card-title {
    font-size: 1.05rem;
    font-weight: 700;
  }

  .agent-spend-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .agent-spend-item {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .spend-info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .agent-item-name {
    display: block;
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .agent-item-stats {
    display: block;
    font-size: 0.72rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .spend-val {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary);
    font-family: var(--font-mono);
  }

  .limit-val {
    font-size: 0.78rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .track-bar {
    height: 6px;
    background: var(--border-color);
    border-radius: 3px;
    overflow: hidden;
  }

  .fill-bar {
    height: 100%;
    background: #06b6d4;
    border-radius: 3px;
  }

  .config-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    flex: 1;
  }

  .form-group label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .form-group input {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.55rem 0.75rem;
    border-radius: 6px;
    font-size: 0.9rem;
    font-family: var(--font-mono);
    outline: none;
  }

  .form-group input:focus {
    border-color: var(--border-focus);
  }

  .hint {
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .form-row {
    display: flex;
    gap: 1rem;
  }

  .alert {
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 0.85rem;
  }
  .alert-success { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
  .alert-error { background: rgba(244, 63, 94, 0.15); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.3); }

  .live-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 6px #10b981;
    margin-right: 5px;
    animation: livePulse 1.4s infinite;
  }

  @keyframes livePulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.25; }
  }

  .empty-usage-state {
    padding: 1.25rem 1rem;
    text-align: center;
    font-size: 0.82rem;
    color: var(--text-muted);
    background: var(--bg-secondary);
    border: 1px dashed var(--border-color);
    border-radius: 6px;
    line-height: 1.5;
  }

  .live-token-feed {
    margin-top: 1rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    overflow: hidden;
    background: var(--bg-card);
  }

  .feed-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.45rem 0.7rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .feed-title {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--accent-emerald);
  }

  .feed-count {
    font-size: 0.68rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .feed-body {
    max-height: 190px;
    overflow-y: auto;
    padding: 0.4rem 0.7rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-family: var(--font-mono);
    font-size: 0.72rem;
  }

  .feed-idle {
    padding: 0.9rem 0;
    text-align: center;
    color: var(--text-muted);
  }

  .feed-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    white-space: nowrap;
  }

  .f-time { color: #475569; }
  .f-agent { color: #38bdf8; flex: 1; overflow: hidden; text-overflow: ellipsis; }
  .f-tokens { color: #e2e8f0; }
  .f-cost { color: #fbbf24; }
</style>
