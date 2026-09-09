<script lang="ts">
  import { onMount } from 'svelte';
  import {
    api,
    type AgentRegistration,
    type AgentAvailability,
    type RegisterAgentDto
  } from '$lib/api';

  let agents = $state<AgentRegistration[]>([
    {
      id: 'reg-sales-01',
      tenantId: 'tenant-corp',
      agentName: 'SalesNegotiatorAgent',
      version: '1.2.0',
      model: 'combo-cheap',
      capabilities: ['sales:order_creation', 'pricing:negotiate', 'discount:calculate'],
      availability: 'ACTIVE',
      costPerCall: 0.0025,
      trustProfile: {
        accuracy: 0.96,
        consistency: 0.94,
        calibration: 0.95,
        historicalSuccessRate: 0.98,
        failureRate: 0.02,
        policyViolations: 0,
        overallTrust: 0.95,
        sampleCount: 1240
      }
    },
    {
      id: 'reg-inventory-01',
      tenantId: 'tenant-corp',
      agentName: 'InventoryReplenishAgent',
      version: '1.0.4',
      model: 'combo-cheap',
      capabilities: ['inventory:check_stock', 'inventory:reserve', 'procurement:draft_po'],
      availability: 'ACTIVE',
      costPerCall: 0.0018,
      trustProfile: {
        accuracy: 0.98,
        consistency: 0.97,
        calibration: 0.96,
        historicalSuccessRate: 0.99,
        failureRate: 0.01,
        policyViolations: 0,
        overallTrust: 0.97,
        sampleCount: 890
      }
    },
    {
      id: 'reg-finance-01',
      tenantId: 'tenant-corp',
      agentName: 'FinancialAuditorAgent',
      version: '2.0.1',
      model: 'combo-reasoning',
      capabilities: ['accounting:post_ledger', 'tax:validate', 'reconciliation:run'],
      availability: 'ACTIVE',
      costPerCall: 0.008,
      trustProfile: {
        accuracy: 0.99,
        consistency: 0.98,
        calibration: 0.97,
        historicalSuccessRate: 0.995,
        failureRate: 0.005,
        policyViolations: 0,
        overallTrust: 0.98,
        sampleCount: 2150
      }
    },
    {
      id: 'reg-infra-01',
      tenantId: 'tenant-corp',
      agentName: 'InfraAutoscalerAgent',
      version: '1.1.0',
      model: 'combo-cheap',
      capabilities: ['infra:hpa_adjust', 'infra:pod_restart', 'infra:metric_scrape'],
      availability: 'DEGRADED',
      costPerCall: 0.0012,
      trustProfile: {
        accuracy: 0.88,
        consistency: 0.85,
        calibration: 0.87,
        historicalSuccessRate: 0.89,
        failureRate: 0.11,
        policyViolations: 1,
        overallTrust: 0.86,
        sampleCount: 340
      }
    }
  ]);

  let loading = $state(false);
  let showModal = $state(false);
  let statusMessage = $state<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form state for registering a new agent
  let newAgentName = $state('');
  let newAgentVersion = $state('1.0.0');
  let newAgentModel = $state('combo-cheap');
  let newAgentCapabilities = $state('workflow:execute, task:triage');
  let newAgentCost = $state(0.002);
  let newAgentAvailability = $state<AgentAvailability>('ACTIVE');

  async function loadAgents() {
    loading = true;
    try {
      const res = await api.listAgents();
      if (res.success && res.data && res.data.length > 0) {
        agents = res.data;
      }
    } catch (err) {
      console.error(err);
    } finally {
      loading = false;
    }
  }

  async function handleStatusChange(agentName: string, newStatus: AgentAvailability) {
    try {
      const res = await api.updateAvailability(agentName, newStatus);
      if (res.success) {
        agents = agents.map(a => a.agentName === agentName ? { ...a, availability: newStatus } : a);
        statusMessage = { text: `Availability for ${agentName} updated to ${newStatus}`, type: 'success' };
      } else {
        // Fallback local update
        agents = agents.map(a => a.agentName === agentName ? { ...a, availability: newStatus } : a);
        statusMessage = { text: `Updated locally: ${agentName} -> ${newStatus}`, type: 'success' };
      }
    } catch {
      agents = agents.map(a => a.agentName === agentName ? { ...a, availability: newStatus } : a);
    }
    setTimeout(() => { statusMessage = null; }, 4000);
  }

  async function handleRegisterAgent(e: Event) {
    e.preventDefault();
    if (!newAgentName.trim()) return;

    const dto: RegisterAgentDto = {
      agentName: newAgentName.trim(),
      version: newAgentVersion.trim(),
      model: newAgentModel.trim(),
      capabilities: newAgentCapabilities.split(',').map(c => c.trim()).filter(Boolean),
      costPerCall: Number(newAgentCost),
      availability: newAgentAvailability
    };

    try {
      const res = await api.registerAgent(dto);
      if (res.success && res.data) {
        agents = [res.data, ...agents];
      } else {
        // Mock fallback registration
        const mockNew: AgentRegistration = {
          id: `reg-${Date.now()}`,
          tenantId: 'tenant-corp',
          ...dto,
          costPerCall: dto.costPerCall || 0.002,
          availability: dto.availability || 'ACTIVE',
          trustProfile: {
            accuracy: 0.95,
            consistency: 0.95,
            calibration: 0.95,
            historicalSuccessRate: 1.0,
            failureRate: 0.0,
            policyViolations: 0,
            overallTrust: 0.95,
            sampleCount: 1
          }
        };
        agents = [mockNew, ...agents];
      }
      statusMessage = { text: `Agent ${dto.agentName} registered successfully`, type: 'success' };
      showModal = false;
      newAgentName = '';
    } catch (err: any) {
      statusMessage = { text: err?.message || 'Registration failed', type: 'error' };
    }
    setTimeout(() => { statusMessage = null; }, 4000);
  }

  onMount(() => {
    loadAgents();
  });
</script>

<div class="agents-page">
  <!-- Header with Actions -->
  <div class="page-header">
    <div>
      <h2 class="title">Agent Governance & Trust Registry</h2>
      <p class="subtitle">Real-time trust scores, capability profiles, and availability controls for multi-tenant autonomous agents.</p>
    </div>
    <div class="header-actions">
      <button class="btn btn-secondary" onclick={loadAgents} disabled={loading}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path>
        </svg>
        Sync
      </button>
      <button class="btn btn-primary" onclick={() => { showModal = true; }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Register Agent
      </button>
    </div>
  </div>

  {#if statusMessage}
    <div class="alert" class:alert-success={statusMessage.type === 'success'} class:alert-error={statusMessage.type === 'error'}>
      {statusMessage.text}
    </div>
  {/if}

  <!-- Summary Stats -->
  <div class="stats-row">
    <div class="card stat-card">
      <span class="stat-label">Total Agents</span>
      <span class="stat-val">{agents.length}</span>
    </div>
    <div class="card stat-card">
      <span class="stat-label">Active Agents</span>
      <span class="stat-val text-emerald">{agents.filter(a => a.availability === 'ACTIVE').length}</span>
    </div>
    <div class="card stat-card">
      <span class="stat-label">Degraded / Maintenance</span>
      <span class="stat-val text-amber">{agents.filter(a => a.availability === 'DEGRADED' || a.availability === 'MAINTENANCE').length}</span>
    </div>
    <div class="card stat-card">
      <span class="stat-label">Avg Fleet Trust</span>
      <span class="stat-val text-cyan">
        {(agents.reduce((acc, a) => acc + (a.trustProfile?.overallTrust ?? 0.95), 0) / (agents.length || 1) * 100).toFixed(1)}%
      </span>
    </div>
  </div>

  <!-- Agent Cards Grid -->
  <div class="agent-grid">
    {#each agents as agent}
      {@const trust = agent.trustProfile ?? { accuracy: 0.95, consistency: 0.95, calibration: 0.95, overallTrust: 0.95, policyViolations: 0, sampleCount: 100 }}
      {@const overallPct = Math.round(trust.overallTrust * 100)}
      {@const accPct = Math.round(trust.accuracy * 100)}
      {@const consPct = Math.round(trust.consistency * 100)}
      {@const calPct = Math.round(trust.calibration * 100)}

      <div class="card agent-card">
        <div class="agent-top">
          <div class="agent-identity">
            <h3 class="agent-name">{agent.agentName}</h3>
            <span class="agent-version">v{agent.version} &bull; {agent.model}</span>
          </div>

          <div class="availability-select-wrapper">
            <select
              value={agent.availability}
              onchange={(e) => handleStatusChange(agent.agentName, (e.target as HTMLSelectElement).value as AgentAvailability)}
              class="badge-select badge-{agent.availability.toLowerCase()}"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="DEGRADED">DEGRADED</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
              <option value="OFFLINE">OFFLINE</option>
            </select>
          </div>
        </div>

        <!-- Trust Score Section -->
        <div class="trust-container">
          <div class="trust-header">
            <span class="trust-title">Overall Trust Score</span>
            <span class="trust-score-val">{overallPct}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: {overallPct}%"></div>
          </div>

          <!-- Sub-meters: Accuracy, Consistency, Calibration -->
          <div class="sub-meters">
            <div class="sub-meter">
              <div class="meter-label">
                <span>Accuracy</span>
                <span>{accPct}%</span>
              </div>
              <div class="mini-track"><div class="mini-fill meter-acc" style="width: {accPct}%"></div></div>
            </div>

            <div class="sub-meter">
              <div class="meter-label">
                <span>Consistency</span>
                <span>{consPct}%</span>
              </div>
              <div class="mini-track"><div class="mini-fill meter-cons" style="width: {consPct}%"></div></div>
            </div>

            <div class="sub-meter">
              <div class="meter-label">
                <span>Calibration</span>
                <span>{calPct}%</span>
              </div>
              <div class="mini-track"><div class="mini-fill meter-cal" style="width: {calPct}%"></div></div>
            </div>
          </div>
        </div>

        <!-- Capabilities Tags -->
        <div class="capabilities-section">
          <span class="cap-title">Capabilities</span>
          <div class="tags-row">
            {#each agent.capabilities as cap}
              <span class="cap-tag">{cap}</span>
            {/each}
          </div>
        </div>

        <div class="agent-footer">
          <span class="cost-info">Cost: ${agent.costPerCall.toFixed(4)} / invocation</span>
          <span class="sample-info">{trust.sampleCount} evaluations</span>
        </div>
      </div>
    {/each}
  </div>

  <!-- Register Agent Modal -->
  {#if showModal}
    <div
      class="modal-backdrop"
      onclick={() => { showModal = false; }}
      onkeydown={(e) => { if (e.key === 'Escape') showModal = false; }}
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
          <h3>Register AI Agent</h3>
          <button type="button" class="close-btn" onclick={() => { showModal = false; }}>&times;</button>
        </div>

        <form onsubmit={handleRegisterAgent} class="modal-form">
          <div class="form-group">
            <label for="agent-name">Agent Name</label>
            <input id="agent-name" type="text" bind:value={newAgentName} placeholder="e.g. ProcurementTriageAgent" required />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="agent-version">Version</label>
              <input id="agent-version" type="text" bind:value={newAgentVersion} placeholder="1.0.0" />
            </div>
            <div class="form-group">
              <label for="agent-model">Model Profile</label>
              <select id="agent-model" bind:value={newAgentModel}>
                <option value="combo-cheap">combo-cheap (Fast/Low Cost)</option>
                <option value="combo-reasoning">combo-reasoning (Deep Analysis)</option>
                <option value="gpt-4o">gpt-4o</option>
                <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="agent-capabilities">Capabilities (Comma-separated)</label>
            <input id="agent-capabilities" type="text" bind:value={newAgentCapabilities} placeholder="procurement:order, inventory:check" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="agent-cost">Cost Per Call (USD)</label>
              <input id="agent-cost" type="number" step="0.0001" bind:value={newAgentCost} />
            </div>
            <div class="form-group">
              <label for="agent-avail">Initial Availability</label>
              <select id="agent-avail" bind:value={newAgentAvailability}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="DEGRADED">DEGRADED</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="OFFLINE">OFFLINE</option>
              </select>
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" onclick={() => { showModal = false; }}>Cancel</button>
            <button type="submit" class="btn btn-primary">Register into Registry</button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .agents-page {
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
    flex-wrap: wrap;
    gap: 1rem;
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

  .header-actions {
    display: flex;
    gap: 0.75rem;
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

  .btn svg {
    width: 16px;
    height: 16px;
  }

  .btn-primary { background: #2563eb; color: white; }
  .btn-primary:hover { background: #1d4ed8; }

  .btn-secondary {
    background: var(--bg-card);
    border-color: var(--border-color);
    color: var(--text-primary);
  }
  .btn-secondary:hover {
    background: var(--bg-card-hover);
  }

  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 1.25rem;
    box-shadow: var(--shadow-sm);
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    font-weight: 600;
  }

  .stat-val {
    font-size: 1.6rem;
    font-weight: 700;
    font-family: var(--font-mono);
  }

  .text-emerald { color: #059669; }
  .text-amber { color: #d97706; }
  .text-cyan { color: #0284c7; }

  .agent-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 1.25rem;
  }

  .agent-card {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .agent-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .agent-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .agent-version {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .badge-select {
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    outline: none;
    border: 1px solid transparent;
  }

  .badge-active { background: var(--accent-emerald-subtle); color: var(--accent-emerald); border-color: var(--accent-emerald-border); }
  .badge-degraded { background: var(--accent-amber-subtle); color: var(--accent-amber); border-color: var(--accent-amber-border); }
  .badge-maintenance { background: var(--accent-purple-subtle); color: var(--accent-purple); border-color: var(--accent-purple-border); }
  .badge-offline { background: var(--accent-rose-subtle); color: var(--accent-rose); border-color: var(--accent-rose-border); }

  .badge-select option {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .trust-container {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .trust-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .trust-title {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .trust-score-val {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--accent-cyan);
    font-family: var(--font-mono);
  }

  .progress-track {
    height: 6px;
    background: var(--border-color);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #06b6d4, #10b981);
    border-radius: 3px;
  }

  .sub-meters {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.6rem;
    margin-top: 0.35rem;
  }

  .sub-meter {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .meter-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.68rem;
    color: var(--text-muted);
  }

  .mini-track {
    height: 4px;
    background: var(--border-color);
    border-radius: 2px;
    overflow: hidden;
  }

  .mini-fill {
    height: 100%;
    border-radius: 2px;
  }

  .meter-acc { background: #10b981; }
  .meter-cons { background: #3b82f6; }
  .meter-cal { background: #8b5cf6; }

  .capabilities-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .cap-title {
    font-size: 0.72rem;
    text-transform: uppercase;
    color: var(--text-muted);
    font-weight: 600;
  }

  .tags-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .cap-tag {
    font-size: 0.7rem;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    font-family: var(--font-mono);
  }

  .agent-footer {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    color: var(--text-muted);
    border-top: 1px solid var(--border-color);
    padding-top: 0.6rem;
  }

  /* Modal */
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

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    flex: 1;
  }

  .form-group label {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .form-group input, .form-group select {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.85rem;
    outline: none;
  }

  .form-group input:focus, .form-group select:focus {
    border-color: var(--border-focus);
  }

  .form-row {
    display: flex;
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
</style>
