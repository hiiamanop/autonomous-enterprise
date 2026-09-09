<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type ObservabilitySnapshot } from '$lib/api';

  let loading = $state(true);
  let errorMsg = $state<string | null>(null);
  let snapshot = $state<ObservabilitySnapshot>({
    tenantId: 'tenant-corp',
    capturedAt: new Date().toISOString(),
    business: {
      totalAuditEvents: 1420,
      actionsByType: {
        'ORDER_FULFILLMENT': 540,
        'FINANCIAL_POSTING': 380,
        'PURCHASE_APPROVAL': 260,
        'OVERTIME_APPROVAL': 140,
        'INVENTORY_REORDER': 100
      },
      failureCount: 14,
      successCount: 1406
    },
    ai: {
      agentCount: 8,
      averageTrustScore: 0.942,
      totalAiCalls: 4820,
      totalTokensUsed: 1285040,
      budgetExceededCount: 0,
      circuitBreakerTriggeredCount: 2,
      escalationCount: 7
    },
    infrastructure: {
      totalScalingEvents: 42,
      executedScalingEvents: 38,
      rejectedScalingEvents: 2,
      escalatedScalingEvents: 1,
      failedScalingEvents: 1
    }
  });

  async function loadSnapshot() {
    loading = true;
    errorMsg = null;
    try {
      const res = await api.getObservabilitySnapshot();
      if (res.success && res.data) {
        snapshot = res.data;
      }
    } catch (e: any) {
      errorMsg = e?.message || 'Failed to fetch snapshot';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadSnapshot();
  });

  let businessSuccessRate = $derived(
    snapshot.business.totalAuditEvents > 0
      ? ((snapshot.business.successCount / snapshot.business.totalAuditEvents) * 100).toFixed(1)
      : '100.0'
  );

  let trustScorePercent = $derived(Math.round(snapshot.ai.averageTrustScore * 100));
</script>

<div class="dashboard-page">
  <!-- Top Bar Controls -->
  <div class="header-actions">
    <div>
      <h2 class="section-heading">Executive 3-Layer Observability</h2>
      <p class="section-sub">Cross-cutting visibility across Business Throughput, AI Decision Governance, and Infrastructure Mesh.</p>
    </div>
    <div class="action-buttons">
      <span class="timestamp-badge">Snapshot: {new Date(snapshot.capturedAt).toLocaleTimeString()}</span>
      <button class="btn btn-primary" onclick={loadSnapshot} disabled={loading}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:spin={loading}>
          <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path>
        </svg>
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  </div>

  <!-- LAYER 1: BUSINESS OPERATIONS & THROUGHPUT -->
  <section class="layer-section">
    <div class="layer-header">
      <div class="layer-tag layer-1">Layer 1</div>
      <h3 class="layer-title">Business Operations & Throughput</h3>
      <span class="layer-metric-pill">{snapshot.business.totalAuditEvents.toLocaleString()} Total Events</span>
    </div>

    <div class="metric-grid-4">
      <div class="card metric-card">
        <span class="card-label">Total Audit Logs</span>
        <div class="card-val">{snapshot.business.totalAuditEvents.toLocaleString()}</div>
        <div class="card-footer text-emerald">Audit Trail Immutability Active</div>
      </div>

      <div class="card metric-card">
        <span class="card-label">Success Rate</span>
        <div class="card-val">{businessSuccessRate}%</div>
        <div class="card-footer text-emerald">{snapshot.business.successCount.toLocaleString()} Successful Actions</div>
      </div>

      <div class="card metric-card">
        <span class="card-label">Failures / Policy Blocks</span>
        <div class="card-val">{snapshot.business.failureCount.toLocaleString()}</div>
        <div class="card-footer text-rose">Rejections quarantined</div>
      </div>

      <div class="card metric-card">
        <span class="card-label">Active Business Domains</span>
        <div class="card-val">{Object.keys(snapshot.business.actionsByType).length}</div>
        <div class="card-footer text-cyan">Sales, Inventory, HR, Finance</div>
      </div>
    </div>

    <div class="card chart-card">
      <div class="chart-header">
        <h4 class="chart-title">Action Distribution by Business Module</h4>
      </div>
      <div class="bar-breakdown">
        {#each Object.entries(snapshot.business.actionsByType) as [actionName, count]}
          {@const pct = snapshot.business.totalAuditEvents > 0 ? (count / snapshot.business.totalAuditEvents) * 100 : 0}
          <div class="bar-row">
            <div class="bar-labels">
              <span class="bar-name">{actionName.replace(/_/g, ' ')}</span>
              <span class="bar-val">{count} ({pct.toFixed(1)}%)</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width: {pct}%"></div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- LAYER 2: AI COGNITIVE & TRUST LAYER -->
  <section class="layer-section">
    <div class="layer-header">
      <div class="layer-tag layer-2">Layer 2</div>
      <h3 class="layer-title">AI Cognitive & Autonomous Governance</h3>
      <span class="layer-metric-pill">{snapshot.ai.agentCount} Registered Agents</span>
    </div>

    <div class="metric-grid-4">
      <div class="card metric-card highlight-cyan">
        <span class="card-label">Average Trust Score</span>
        <div class="card-val font-accent">{trustScorePercent}%</div>
        <div class="trust-meter">
          <div class="trust-fill" style="width: {trustScorePercent}%"></div>
        </div>
        <div class="card-footer">Accuracy, Consistency & Calibration</div>
      </div>

      <div class="card metric-card">
        <span class="card-label">Total Tokens Used</span>
        <div class="card-val">{(snapshot.ai.totalTokensUsed / 1000).toFixed(1)}k</div>
        <div class="card-footer text-cyan">{snapshot.ai.totalAiCalls.toLocaleString()} Total Invocations</div>
      </div>

      <div class="card metric-card">
        <span class="card-label">Circuit Breakers</span>
        <div class="card-val">{snapshot.ai.circuitBreakerTriggeredCount}</div>
        <div class="card-footer text-amber">Loop Prevention & Self-Healing</div>
      </div>

      <div class="card metric-card">
        <span class="card-label">Human Escalations</span>
        <div class="card-val">{snapshot.ai.escalationCount}</div>
        <div class="card-footer text-purple">High-Value / Low-Confidence Routing</div>
      </div>
    </div>
  </section>

  <!-- LAYER 3: INFRASTRUCTURE & SCALING MESH -->
  <section class="layer-section">
    <div class="layer-header">
      <div class="layer-tag layer-3">Layer 3</div>
      <h3 class="layer-title">Infrastructure & Pod Mesh Scaling</h3>
      <span class="layer-metric-pill">{snapshot.infrastructure.totalScalingEvents} Total Autoscaling Decisions</span>
    </div>

    <div class="metric-grid-4">
      <div class="card metric-card">
        <span class="card-label">Executed Scalings</span>
        <div class="card-val text-emerald">{snapshot.infrastructure.executedScalingEvents}</div>
        <div class="card-footer">Pods safely adjusted</div>
      </div>

      <div class="card metric-card">
        <span class="card-label">Rejected Scalings</span>
        <div class="card-val text-amber">{snapshot.infrastructure.rejectedScalingEvents}</div>
        <div class="card-footer">Cooldown / Policy limits applied</div>
      </div>

      <div class="card metric-card">
        <span class="card-label">Escalated Scalings</span>
        <div class="card-val text-purple">{snapshot.infrastructure.escalatedScalingEvents}</div>
        <div class="card-footer">Critical node reallocation</div>
      </div>

      <div class="card metric-card">
        <span class="card-label">Failed Scalings</span>
        <div class="card-val text-rose">{snapshot.infrastructure.failedScalingEvents}</div>
        <div class="card-footer">Kubernetes API resilience</div>
      </div>
    </div>
  </section>
</div>

<style>
  .dashboard-page {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .header-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .section-heading {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .section-sub {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .timestamp-badge {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
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
    border: none;
    transition: all 0.15s ease;
  }

  .btn svg {
    width: 16px;
    height: 16px;
  }

  .btn-primary {
    background: #2563eb;
    color: white;
  }
  .btn-primary:hover {
    background: #1d4ed8;
  }

  .spin {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    100% { transform: rotate(360deg); }
  }

  .layer-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .layer-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .layer-tag {
    font-size: 0.65rem;
    font-weight: 800;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .layer-1 { background: var(--accent-emerald-subtle); color: var(--accent-emerald); border: 1px solid var(--accent-emerald-border); }
  .layer-2 { background: var(--accent-blue-subtle); color: var(--accent-blue); border: 1px solid var(--accent-blue-border); }
  .layer-3 { background: var(--accent-purple-subtle); color: var(--accent-purple); border: 1px solid var(--accent-purple-border); }

  .layer-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .layer-metric-pill {
    margin-left: auto;
    font-size: 0.75rem;
    font-family: var(--font-mono);
    color: var(--text-secondary);
    background: var(--bg-secondary);
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    font-weight: 500;
  }

  .metric-grid-4 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
  }

  .card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 1.25rem;
    box-shadow: var(--shadow-sm);
  }

  .metric-card {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .card-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
    font-weight: 600;
  }

  .card-val {
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--text-primary);
    font-family: var(--font-mono);
  }

  .font-accent {
    color: var(--accent-cyan);
  }

  .card-footer {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
  }

  .text-emerald { color: #059669; }
  .text-cyan { color: #0284c7; }
  .text-amber { color: #d97706; }
  .text-rose { color: #e11d48; }
  .text-purple { color: #7c3aed; }

  .trust-meter {
    height: 6px;
    background: var(--border-color);
    border-radius: 3px;
    overflow: hidden;
    margin-top: 0.25rem;
  }
  .trust-fill {
    height: 100%;
    background: linear-gradient(90deg, #06b6d4, #10b981);
    border-radius: 3px;
  }

  .chart-card {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .chart-title {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .bar-breakdown {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .bar-row {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .bar-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
  }

  .bar-name {
    color: var(--text-primary);
    font-weight: 500;
  }

  .bar-val {
    color: var(--text-secondary);
    font-family: var(--font-mono);
  }

  .bar-track {
    height: 8px;
    background: var(--border-color);
    border-radius: 4px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #06b6d4);
    border-radius: 4px;
    transition: width 0.3s ease;
  }
</style>
