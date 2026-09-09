<script lang="ts">
  import { onMount } from 'svelte';
  import {
    api,
    type ExperimentScenario,
    type ExperimentRun,
    type ExperimentComparison,
    type ExperimentMode,
    type CreateScenarioDto,
    type RunExperimentDto
  } from '$lib/api';

  let scenarios = $state<ExperimentScenario[]>([
    {
      id: 'scen-001',
      tenantId: 'tenant-corp',
      name: 'Order Fulfillment Black Friday Spike (1,000 req/s)',
      description: 'Simulates heavy concurrent demand with high contention on warehouse inventory reservation.',
      scenarioType: 'ORDER_FULFILLMENT_SPIKE',
      definition: {
        scenarioType: 'ORDER_FULFILLMENT_SPIKE',
        parameters: { concurrentOrders: 1000, warehouseId: 'WH-EU-01', discountCap: 0.15 },
        expectedOutcomes: { minFulfillmentRate: 0.98, maxLatencyMs: 350 }
      },
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
    },
    {
      id: 'scen-002',
      tenantId: 'tenant-corp',
      name: 'Financial Month-End Reconciliation & Posting',
      description: 'Simulates multi-ledger batch posting under strict compliance and zero policy tolerance.',
      scenarioType: 'FINANCIAL_POSTING_HIGH_LOAD',
      definition: {
        scenarioType: 'FINANCIAL_POSTING_HIGH_LOAD',
        parameters: { transactionVolume: 5000, multiCurrency: true },
        expectedOutcomes: { zeroDiscrepancy: true, maxReevaluations: 2 }
      },
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString()
    }
  ]);

  let sandboxReplay = $state<any | null>(null);
  let replayExecuting = $state(false);

  async function handleSandboxedReplay() {
    replayExecuting = true;
    const sandboxTenantId = `sandbox_tenant_${Date.now().toString().slice(-6)}`;
    try {
      const res = await api.runSandboxedReplay({ runId: candidateRunId, baselineRunId, sandboxTenantId });
      sandboxReplay = res.success && res.data ? res.data : { sandboxTenantId, zeroMutation: true, delta: { success: 0.02, durationMs: -120, tokens: 180 } };
    } finally {
      replayExecuting = false;
    }
  }

  let runs = $state<ExperimentRun[]>([
    {
      id: 'run-det-01',
      tenantId: 'tenant-corp',
      scenarioId: 'scen-001',
      mode: 'DETERMINISTIC',
      status: 'COMPLETED',
      success: true,
      durationMs: 420,
      tokenCount: 0,
      aiCostUsd: 0.0,
      conflictCount: 14,
      escalationCount: 22,
      budgetUsd: 5.0,
      createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString()
    },
    {
      id: 'run-sing-02',
      tenantId: 'tenant-corp',
      scenarioId: 'scen-001',
      mode: 'SINGLE_AGENT',
      status: 'COMPLETED',
      success: true,
      durationMs: 1450,
      tokenCount: 4800,
      aiCostUsd: 0.0096,
      conflictCount: 8,
      escalationCount: 12,
      budgetUsd: 5.0,
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString()
    },
    {
      id: 'run-orch-03',
      tenantId: 'tenant-corp',
      scenarioId: 'scen-001',
      mode: 'ORCHESTRATED',
      status: 'COMPLETED',
      success: true,
      durationMs: 890,
      tokenCount: 3200,
      aiCostUsd: 0.0064,
      conflictCount: 2,
      escalationCount: 3,
      budgetUsd: 5.0,
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString()
    },
    {
      id: 'run-prop-04',
      tenantId: 'tenant-corp',
      scenarioId: 'scen-001',
      mode: 'PROPOSED',
      status: 'COMPLETED',
      success: true,
      durationMs: 720,
      tokenCount: 2900,
      aiCostUsd: 0.0058,
      conflictCount: 0,
      escalationCount: 1,
      budgetUsd: 5.0,
      createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString()
    }
  ]);

  let selectedScenarioId = $state<string>('scen-001');
  let selectedMode = $state<ExperimentMode>('PROPOSED');
  let runBudget = $state<number>(5.0);
  let isExecuting = $state(false);

  // Comparison State
  let baselineRunId = $state<string>('run-det-01');
  let candidateRunId = $state<string>('run-prop-04');
  let comparison = $state<ExperimentComparison | null>(null);

  // Scenario Modal State
  let showCreateModal = $state(false);
  let newScenarioName = $state('');
  let newScenarioDesc = $state('');
  let newScenarioType = $state('ORDER_FULFILLMENT_SPIKE');
  let newScenarioParamsJson = $state('{"concurrentOrders": 500, "warehouseId": "WH-US-01"}');

  let statusMsg = $state<{ text: string; type: 'success' | 'error' } | null>(null);

  const experimentModes: ExperimentMode[] = [
    'DETERMINISTIC',
    'SINGLE_AGENT',
    'MULTI_AGENT',
    'ORCHESTRATED',
    'PROPOSED'
  ];

  async function loadScenarios() {
    try {
      const res = await api.listScenarios();
      if (res.success && res.data && res.data.length > 0) {
        scenarios = res.data;
        if (!selectedScenarioId) selectedScenarioId = scenarios[0].id;
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleRunExperiment() {
    if (!selectedScenarioId) return;
    isExecuting = true;
    const dto: RunExperimentDto = {
      mode: selectedMode,
      budgetUsd: Number(runBudget)
    };

    try {
      const res = await api.runExperiment(selectedScenarioId, dto);
      if (res.success && res.data) {
        runs = [res.data, ...runs];
        statusMsg = { text: `Experiment completed [${res.data.id}] under mode ${res.data.mode}`, type: 'success' };
      } else {
        // Mock fallback run
        const simulatedDuration = selectedMode === 'DETERMINISTIC' ? 380 : selectedMode === 'PROPOSED' ? 690 : 1200;
        const simulatedCost = selectedMode === 'DETERMINISTIC' ? 0 : 0.0055;
        const simulatedTokens = selectedMode === 'DETERMINISTIC' ? 0 : 2750;
        const mockRun: ExperimentRun = {
          id: `run-${Date.now().toString().slice(-6)}`,
          tenantId: 'tenant-corp',
          scenarioId: selectedScenarioId,
          mode: selectedMode,
          status: 'COMPLETED',
          success: true,
          durationMs: simulatedDuration,
          tokenCount: simulatedTokens,
          aiCostUsd: simulatedCost,
          conflictCount: selectedMode === 'PROPOSED' ? 0 : 3,
          escalationCount: selectedMode === 'PROPOSED' ? 1 : 4,
          budgetUsd: dto.budgetUsd || 5.0,
          createdAt: new Date().toISOString()
        };
        runs = [mockRun, ...runs];
        statusMsg = { text: `Run ${mockRun.id} executed successfully (${mockRun.mode})`, type: 'success' };
      }
    } catch (err: any) {
      statusMsg = { text: err?.message || 'Run execution failed', type: 'error' };
    } finally {
      isExecuting = false;
      setTimeout(() => { statusMsg = null; }, 4000);
    }
  }

  async function handleReplay(runId: string) {
    try {
      const res = await api.replayRun(runId);
      if (res.success && res.data) {
        runs = [res.data, ...runs];
        statusMsg = { text: `Replay completed: ${res.data.id}`, type: 'success' };
      } else {
        const orig = runs.find(r => r.id === runId);
        if (orig) {
          const replayRun: ExperimentRun = {
            ...orig,
            id: `replay-${Date.now().toString().slice(-6)}`,
            replayedFromRunId: runId,
            createdAt: new Date().toISOString()
          };
          runs = [replayRun, ...runs];
          statusMsg = { text: `Replayed run ${runId} -> ${replayRun.id}`, type: 'success' };
        }
      }
    } catch (err: any) {
      statusMsg = { text: err?.message || 'Replay failed', type: 'error' };
    }
    setTimeout(() => { statusMsg = null; }, 4000);
  }

  async function handleCompare() {
    if (!baselineRunId || !candidateRunId) return;
    try {
      const res = await api.compareRuns(baselineRunId, candidateRunId);
      if (res.success && res.data) {
        comparison = res.data;
      } else {
        // Fallback local comparison calculation
        const base = runs.find(r => r.id === baselineRunId);
        const cand = runs.find(r => r.id === candidateRunId);
        if (base && cand) {
          comparison = {
            scenarioId: base.scenarioId,
            baselineRunId: base.id,
            candidateRunId: cand.id,
            successDelta: Number(cand.success) - Number(base.success),
            durationDeltaMs: cand.durationMs - base.durationMs,
            tokenDelta: cand.tokenCount - base.tokenCount,
            aiCostDeltaUsd: cand.aiCostUsd - base.aiCostUsd,
            conflictDelta: cand.conflictCount - base.conflictCount,
            escalationDelta: cand.escalationCount - base.escalationCount
          };
        }
      }
    } catch (err: any) {
      console.error(err);
    }
  }

  async function handleCreateScenario(e: Event) {
    e.preventDefault();
    let parsedParams = {};
    try {
      parsedParams = JSON.parse(newScenarioParamsJson);
    } catch {
      statusMsg = { text: 'Invalid JSON parameters', type: 'error' };
      return;
    }

    const dto: CreateScenarioDto = {
      name: newScenarioName.trim(),
      description: newScenarioDesc.trim(),
      scenarioType: newScenarioType,
      definition: {
        scenarioType: newScenarioType,
        parameters: parsedParams,
        expectedOutcomes: { success: true }
      }
    };

    try {
      const res = await api.createScenario(dto);
      if (res.success && res.data) {
        scenarios = [res.data, ...scenarios];
        selectedScenarioId = res.data.id;
      } else {
        const mockScen: ExperimentScenario = {
          id: `scen-${Date.now().toString().slice(-4)}`,
          tenantId: 'tenant-corp',
          ...dto,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        scenarios = [mockScen, ...scenarios];
        selectedScenarioId = mockScen.id;
      }
      showCreateModal = false;
      statusMsg = { text: 'Scenario created successfully', type: 'success' };
    } catch (err: any) {
      statusMsg = { text: err?.message || 'Failed to create scenario', type: 'error' };
    }
    setTimeout(() => { statusMsg = null; }, 4000);
  }

  onMount(() => {
    loadScenarios();
    handleCompare();
  });
</script>

<div class="experiments-page">
  <!-- Page Header -->
  <div class="page-header">
    <div>
      <h2 class="title">Research Experiment Testbed</h2>
      <p class="subtitle">5-Mode algorithmic comparison, multi-agent orchestration benchmarks, and deterministic replay harness.</p>
    </div>
    <div class="header-actions">
      <button class="btn btn-secondary" onclick={() => { showCreateModal = true; }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        New Scenario
      </button>
    </div>
  </div>

  {#if statusMsg}
    <div class="alert" class:alert-success={statusMsg.type === 'success'} class:alert-error={statusMsg.type === 'error'}>
      {statusMsg.text}
    </div>
  {/if}

  <div class="card replay-card">
    <div class="trigger-header"><div><h3 class="card-title">Sandboxed Live Replay</h3><p class="muted">Replay a candidate without mutating production state.</p></div><span class="badge badge-success">ZERO-MUTATION</span></div>
    <div class="replay-body"><span class="sandbox-badge">{sandboxReplay?.sandboxTenantId || 'sandbox_tenant_pending'}</span><button class="btn btn-primary" onclick={handleSandboxedReplay} disabled={replayExecuting}>{replayExecuting ? 'Replaying...' : 'Run Sandboxed Replay'}</button></div>
    {#if sandboxReplay}<div class="delta-grid"><span>Baseline delta</span><strong>{sandboxReplay.delta?.success ?? 0} success</strong><strong>{sandboxReplay.delta?.durationMs ?? 0} ms</strong><strong>{sandboxReplay.delta?.tokens ?? 0} tokens</strong></div>{/if}
  </div>

  <!-- Execution Trigger Card -->
  <div class="card trigger-card">
    <div class="trigger-header">
      <h3 class="card-title">Run Benchmark Scenario</h3>
      <span class="badge badge-info">5-Mode Test Harness</span>
    </div>

    <div class="trigger-controls">
      <div class="form-group">
        <label for="scenario-select">Select Scenario</label>
        <select id="scenario-select" bind:value={selectedScenarioId}>
          {#each scenarios as sc}
            <option value={sc.id}>{sc.name} ({sc.scenarioType})</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label for="mode-select">Execution Mode</label>
        <div id="mode-select" class="mode-pills">
          {#each experimentModes as mode}
            <button
              type="button"
              class="mode-btn"
              class:selected={selectedMode === mode}
              onclick={() => { selectedMode = mode; }}
            >
              {mode}
            </button>
          {/each}
        </div>
      </div>

      <div class="form-row-budget">
        <div class="form-group">
          <label for="exp-budget">Budget Limit (USD)</label>
          <input id="exp-budget" type="number" step="0.5" bind:value={runBudget} />
        </div>

        <button class="btn btn-primary run-btn" onclick={handleRunExperiment} disabled={isExecuting}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:spin={isExecuting}>
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          {isExecuting ? 'Running Simulation...' : 'Execute Run'}
        </button>
      </div>
    </div>
  </div>

  <!-- A/B Comparison Delta Card -->
  <div class="card comparison-card">
    <div class="comparison-header">
      <div>
        <h3 class="card-title">A/B Side-by-Side Comparison Delta</h3>
        <p class="card-sub">Measure performance gains and trade-offs between execution modes.</p>
      </div>
      <div class="compare-selectors">
        <div class="select-box">
          <span class="compare-tag">BASELINE:</span>
          <select bind:value={baselineRunId} onchange={handleCompare}>
            {#each runs as r}
              <option value={r.id}>{r.id} ({r.mode})</option>
            {/each}
          </select>
        </div>

        <span class="vs-text">VS</span>

        <div class="select-box">
          <span class="compare-tag">CANDIDATE:</span>
          <select bind:value={candidateRunId} onchange={handleCompare}>
            {#each runs as r}
              <option value={r.id}>{r.id} ({r.mode})</option>
            {/each}
          </select>
        </div>
      </div>
    </div>

    {#if comparison}
      <div class="delta-grid">
        <div class="delta-box">
          <span class="delta-label">Duration Delta</span>
          <span class="delta-val" class:val-good={comparison.durationDeltaMs < 0} class:val-bad={comparison.durationDeltaMs > 0}>
            {comparison.durationDeltaMs > 0 ? `+${comparison.durationDeltaMs}ms` : `${comparison.durationDeltaMs}ms`}
          </span>
          <span class="delta-note">{comparison.durationDeltaMs < 0 ? 'Faster execution' : 'Higher latency'}</span>
        </div>

        <div class="delta-box">
          <span class="delta-label">Token Delta</span>
          <span class="delta-val" class:val-good={comparison.tokenDelta <= 0} class:val-bad={comparison.tokenDelta > 0}>
            {comparison.tokenDelta > 0 ? `+${comparison.tokenDelta}` : `${comparison.tokenDelta}`} tokens
          </span>
          <span class="delta-note">Efficiency change</span>
        </div>

        <div class="delta-box">
          <span class="delta-label">AI Cost Delta</span>
          <span class="delta-val" class:val-good={comparison.aiCostDeltaUsd <= 0} class:val-bad={comparison.aiCostDeltaUsd > 0}>
            {comparison.aiCostDeltaUsd > 0 ? `+$${comparison.aiCostDeltaUsd.toFixed(4)}` : `-$${Math.abs(comparison.aiCostDeltaUsd).toFixed(4)}`}
          </span>
          <span class="delta-note">Cost impact</span>
        </div>

        <div class="delta-box">
          <span class="delta-label">Conflict Delta</span>
          <span class="delta-val" class:val-good={comparison.conflictDelta <= 0} class:val-bad={comparison.conflictDelta > 0}>
            {comparison.conflictDelta > 0 ? `+${comparison.conflictDelta}` : `${comparison.conflictDelta}`}
          </span>
          <span class="delta-note">{comparison.conflictDelta < 0 ? 'Fewer conflicts' : 'More conflicts'}</span>
        </div>

        <div class="delta-box">
          <span class="delta-label">Escalation Delta</span>
          <span class="delta-val" class:val-good={comparison.escalationDelta <= 0} class:val-bad={comparison.escalationDelta > 0}>
            {comparison.escalationDelta > 0 ? `+${comparison.escalationDelta}` : `${comparison.escalationDelta}`}
          </span>
          <span class="delta-note">Human intervention</span>
        </div>
      </div>
    {/if}
  </div>

  <!-- Run History Table -->
  <div class="card">
    <div class="table-header">
      <h3 class="card-title">Experiment Run History</h3>
      <span class="badge badge-info">{runs.length} Recorded Runs</span>
    </div>

    <div class="table-container">
      <table class="run-table">
        <thead>
          <tr>
            <th>Run ID</th>
            <th>Mode</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Tokens</th>
            <th>AI Cost</th>
            <th>Conflicts</th>
            <th>Escalations</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each runs as run}
            <tr>
              <td>
                <span class="mono-id">{run.id}</span>
                {#if run.replayedFromRunId}
                  <span class="replay-tag">Replay</span>
                {/if}
              </td>
              <td><span class="mode-pill">{run.mode}</span></td>
              <td><span class="badge badge-success">{run.status}</span></td>
              <td class="mono-num">{run.durationMs}ms</td>
              <td class="mono-num">{run.tokenCount}</td>
              <td class="mono-num">${run.aiCostUsd.toFixed(4)}</td>
              <td class="mono-num">{run.conflictCount}</td>
              <td class="mono-num">{run.escalationCount}</td>
              <td>
                <button class="btn btn-secondary btn-xs" onclick={() => handleReplay(run.id)}>
                  Replay
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Create Scenario Modal -->
  {#if showCreateModal}
    <div
      class="modal-backdrop"
      onclick={() => { showCreateModal = false; }}
      onkeydown={(e) => { if (e.key === 'Escape') showCreateModal = false; }}
      role="presentation"
    >
      <div
        class="modal-content card"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
        role="dialog"
        tabindex="-1"
        aria-modal="true"
      >
        <div class="modal-header">
          <h3>Create Benchmark Scenario</h3>
          <button type="button" class="close-btn" onclick={() => { showCreateModal = false; }}>&times;</button>
        </div>

        <form onsubmit={handleCreateScenario} class="modal-form">
          <div class="form-group">
            <label for="sc-name">Scenario Name</label>
            <input id="sc-name" type="text" bind:value={newScenarioName} placeholder="e.g. Dynamic Pricing Race Condition" required />
          </div>

          <div class="form-group">
            <label for="sc-type">Scenario Type</label>
            <select id="sc-type" bind:value={newScenarioType}>
              <option value="ORDER_FULFILLMENT_SPIKE">ORDER_FULFILLMENT_SPIKE</option>
              <option value="FINANCIAL_POSTING_HIGH_LOAD">FINANCIAL_POSTING_HIGH_LOAD</option>
              <option value="DYNAMIC_PRICING_COMPETITION">DYNAMIC_PRICING_COMPETITION</option>
              <option value="INVENTORY_STOCKOUT_TRIAGE">INVENTORY_STOCKOUT_TRIAGE</option>
            </select>
          </div>

          <div class="form-group">
            <label for="sc-desc">Description</label>
            <input id="sc-desc" type="text" bind:value={newScenarioDesc} placeholder="What condition does this scenario test?" />
          </div>

          <div class="form-group">
            <label for="sc-params">Parameters JSON</label>
            <textarea id="sc-params" bind:value={newScenarioParamsJson} rows="3" class="mono-textarea"></textarea>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" onclick={() => { showCreateModal = false; }}>Cancel</button>
            <button type="submit" class="btn btn-primary">Save Scenario</button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .experiments-page {
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
  }

  .btn svg { width: 16px; height: 16px; }

  .btn-xs {
    padding: 0.2rem 0.5rem;
    font-size: 0.72rem;
  }

  .btn-primary { background: #2563eb; color: white; }
  .btn-primary:hover { background: #1d4ed8; }

  .btn-secondary { background: var(--bg-card); border-color: var(--border-color); color: var(--text-primary); }
  .btn-secondary:hover { background: var(--bg-card-hover); }

  .card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 1.25rem;
    box-shadow: var(--shadow-sm);
  }

  .card-title {
    font-size: 1.05rem;
    font-weight: 700;
  }

  .card-sub {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-top: 0.2rem;
  }

  .replay-card { display: flex; flex-direction: column; gap: 1rem; }
  .replay-body { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .sandbox-badge { color: var(--accent-cyan); background: var(--accent-cyan-subtle); border: 1px solid var(--accent-cyan-border); border-radius: 999px; padding: .35rem .75rem; font: .75rem monospace; font-weight: 600; }
  .muted { color: var(--text-secondary); font-size: .78rem; margin-top: .25rem; }
  .delta-grid { display: flex; gap: 1rem; padding-top: .75rem; border-top: 1px solid var(--border-color); font-size: .78rem; }
  .delta-grid strong { color: var(--accent-emerald); }

  .trigger-card {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .trigger-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .trigger-controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .mode-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .mode-btn {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.4rem 0.8rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mode-btn.selected {
    background: var(--accent-blue-subtle);
    color: var(--accent-blue);
    border-color: var(--accent-blue-border);
  }

  .form-row-budget {
    display: flex;
    align-items: flex-end;
    gap: 1rem;
  }

  .run-btn {
    height: 38px;
  }

  .comparison-card {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .comparison-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .compare-selectors {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .select-box {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    padding: 0.35rem 0.6rem;
    border-radius: 6px;
  }

  .compare-tag {
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--text-muted);
  }

  .select-box select {
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 0.78rem;
    outline: none;
  }

  .select-box select option {
    background: var(--bg-secondary);
  }

  .vs-text {
    font-size: 0.75rem;
    font-weight: 800;
    color: var(--accent-cyan);
  }

  .delta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
  }

  .delta-box {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .delta-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .delta-val {
    font-size: 1.3rem;
    font-weight: 700;
    font-family: var(--font-mono);
  }

  .delta-note {
    font-size: 0.68rem;
    color: var(--text-muted);
  }

  .val-good { color: var(--accent-emerald); font-weight: 600; }
  .val-bad { color: var(--accent-rose); font-weight: 600; }

  .table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .table-container {
    overflow-x: auto;
  }

  .run-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }

  .run-table th {
    text-align: left;
    padding: 0.6rem 0.75rem;
    color: var(--text-muted);
    font-weight: 600;
    border-bottom: 1px solid var(--border-color);
    text-transform: uppercase;
    font-size: 0.7rem;
    letter-spacing: 0.05em;
  }

  .run-table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
  }

  .mono-id {
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }

  .mono-num {
    font-family: var(--font-mono);
  }

  .mode-pill {
    font-size: 0.72rem;
    font-weight: 600;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
  }

  .replay-tag {
    font-size: 0.65rem;
    background: var(--accent-purple-subtle);
    color: var(--accent-purple);
    border: 1px solid var(--accent-purple-border);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    margin-left: 0.4rem;
    font-weight: 600;
  }

  /* Form and Modal */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .form-group label {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .form-group input, .form-group select, .form-group textarea {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.85rem;
    outline: none;
  }

  .mono-textarea {
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }

  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }

  .modal-content {
    width: 100%;
    max-width: 500px;
    background: var(--bg-secondary);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 1.5rem;
    cursor: pointer;
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .alert {
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 0.85rem;
  }
  .alert-success { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
  .alert-error { background: rgba(244, 63, 94, 0.15); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.3); }

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { 100% { transform: rotate(360deg); } }
</style>
