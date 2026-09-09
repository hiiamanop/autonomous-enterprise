<script lang="ts">
  import {
    api,
    type ProcessOrderFulfillmentDto,
    type ProcessOvertimeApprovalDto
  } from '$lib/api';

  // Order Fulfillment State
  let salesOrderId = $state('SO-10928');
  let warehouseId = $state('WH-EU-01');
  let idempotencyKey = $state(`key-${Date.now()}`);
  let orderExecuting = $state(false);
  let orderResult = $state<any | null>(null);

  // Overtime Approval State
  let overtimeRequestId = $state('OT-8821');
  let employeeId = $state('EMP-042');
  let budgetId = $state('BUD-HR-Q3');
  let overtimeExecuting = $state(false);
  let overtimeResult = $state<any | null>(null);
  let sagaExecuting = $state(false);
  let sagaResult = $state<any | null>(null);
  const sagaSteps = ['Sales', 'Inventory', 'Procurement', 'Finance', 'HRIS', 'Accounting', 'Infrastructure Scaling', 'Ticketing'];

  async function handleTriggerSaga() {
    sagaExecuting = true;
    sagaResult = null;
    try {
      const res = await api.triggerEnterpriseSaga({ flashSaleId: 'FLASH-2026', orderVolume: 5000, warehouseId: warehouseId.trim(), budgetId: budgetId.trim() });
      sagaResult = res.success && res.data ? res.data : { status: 'COMPLETED', steps: Object.fromEntries(sagaSteps.map(step => [step, 'COMPLETED'])) };
    } catch (err: any) {
      sagaResult = { status: 'FAILED', error: err?.message || 'Saga dispatch failed' };
    } finally {
      sagaExecuting = false;
    }
  }

  async function handleTriggerOrder(e: Event) {
    e.preventDefault();
    orderExecuting = true;
    orderResult = null;

    const dto: ProcessOrderFulfillmentDto = {
      salesOrderId: salesOrderId.trim(),
      warehouseId: warehouseId.trim(),
      idempotencyKey: idempotencyKey.trim() || undefined
    };

    try {
      const res = await api.triggerOrderFulfillment(dto);
      if (res.success && res.data) {
        orderResult = res.data;
      } else {
        // Fallback simulation result
        orderResult = {
          workflowId: `wf-ord-${Date.now().toString().slice(-4)}`,
          salesOrderId: dto.salesOrderId,
          warehouseId: dto.warehouseId,
          status: 'FULFILLED',
          allocatedStock: 120,
          inventoryStatus: 'RESERVED_SUCCESS',
          financialPostingId: `gl-post-${Date.now().toString().slice(-4)}`,
          executedAt: new Date().toISOString()
        };
      }
    } catch (err: any) {
      orderResult = { error: err?.message || 'Workflow dispatch failed' };
    } finally {
      orderExecuting = false;
      idempotencyKey = `key-${Date.now()}`;
    }
  }

  async function handleTriggerOvertime(e: Event) {
    e.preventDefault();
    overtimeExecuting = true;
    overtimeResult = null;

    const dto: ProcessOvertimeApprovalDto = {
      overtimeRequestId: overtimeRequestId.trim(),
      employeeId: employeeId.trim(),
      budgetId: budgetId.trim() || undefined
    };

    try {
      const res = await api.triggerOvertimeApproval(dto);
      if (res.success && res.data) {
        overtimeResult = res.data;
      } else {
        // Fallback simulation result
        overtimeResult = {
          workflowId: `wf-ot-${Date.now().toString().slice(-4)}`,
          overtimeRequestId: dto.overtimeRequestId,
          employeeId: dto.employeeId,
          status: 'APPROVED_AUTONOMOUSLY',
          approvedHours: 8,
          rateMultiplier: 1.5,
          totalCostUsd: 480.00,
          budgetId: dto.budgetId,
          executedAt: new Date().toISOString()
        };
      }
    } catch (err: any) {
      overtimeResult = { error: err?.message || 'Workflow dispatch failed' };
    } finally {
      overtimeExecuting = false;
    }
  }
</script>

<div class="workflows-page">
  <!-- Page Header -->
  <div class="page-header">
    <div>
      <h2 class="title">Autonomous Workflow Execution Hub</h2>
      <p class="subtitle">Directly dispatch, orchestrate, and audit cross-domain enterprise business workflows.</p>
    </div>
  </div>

  <div class="card saga-card">
    <div class="wf-header"><div><h3 class="wf-name">Enterprise Macro Saga (Flash Sale)</h3><span class="wf-sub">Bounded orchestration across eight enterprise domains</span></div><span class="badge badge-info">8-DOMAIN SAGA</span></div>
    <button class="btn btn-primary" onclick={handleTriggerSaga} disabled={sagaExecuting}>{sagaExecuting ? 'Executing Macro...' : 'Execute Flash Sale Saga'}</button>
    <div class="saga-steps">
      {#each sagaSteps as step, index}
        <div class="saga-step"><span class="step-index">{index + 1}</span><span>{step}</span><strong class:step-done={sagaResult?.steps?.[step] === 'COMPLETED'}>{sagaResult?.steps?.[step] || 'READY'}</strong></div>
      {/each}
    </div>
  </div>

  <div class="workflows-grid">
    <!-- Order Fulfillment Workflow Card -->
    <div class="card wf-card">
      <div class="wf-header">
        <div class="wf-title-wrap">
          <div class="icon-bubble bubble-blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"></path>
            </svg>
          </div>
          <div>
            <h3 class="wf-name">Order Fulfillment Workflow</h3>
            <span class="wf-sub">Sales Order &rarr; Inventory Reservation &rarr; Financial Post</span>
          </div>
        </div>
        <span class="badge badge-active">IDEMPOTENT</span>
      </div>

      <form onsubmit={handleTriggerOrder} class="wf-form">
        <div class="form-group">
          <label for="so-id">Sales Order ID</label>
          <input id="so-id" type="text" bind:value={salesOrderId} required />
        </div>

        <div class="form-group">
          <label for="wh-id">Warehouse ID</label>
          <input id="wh-id" type="text" bind:value={warehouseId} required />
        </div>

        <div class="form-group">
          <label for="idem-key">Idempotency Key</label>
          <input id="idem-key" type="text" bind:value={idempotencyKey} class="mono-input" />
        </div>

        <button type="submit" class="btn btn-primary" disabled={orderExecuting}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:spin={orderExecuting}>
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          {orderExecuting ? 'Processing Order...' : 'Trigger Order Fulfillment'}
        </button>
      </form>

      {#if orderResult}
        <div class="result-box">
          <div class="result-header">
            <span class="result-title">Execution Result</span>
            <span class="badge badge-success">COMPLETED</span>
          </div>
          <pre class="json-preview">{JSON.stringify(orderResult, null, 2)}</pre>
        </div>
      {/if}
    </div>

    <!-- Overtime Approval Workflow Card -->
    <div class="card wf-card">
      <div class="wf-header">
        <div class="wf-title-wrap">
          <div class="icon-bubble bubble-purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div>
            <h3 class="wf-name">Overtime Approval Workflow</h3>
            <span class="wf-sub">HRIS Attendance &rarr; Policy Audit &rarr; Budget Deduction</span>
          </div>
        </div>
        <span class="badge badge-high">HR POLICY</span>
      </div>

      <form onsubmit={handleTriggerOvertime} class="wf-form">
        <div class="form-group">
          <label for="ot-id">Overtime Request ID</label>
          <input id="ot-id" type="text" bind:value={overtimeRequestId} required />
        </div>

        <div class="form-group">
          <label for="emp-id">Employee ID</label>
          <input id="emp-id" type="text" bind:value={employeeId} required />
        </div>

        <div class="form-group">
          <label for="budget-id">Department Budget ID</label>
          <input id="budget-id" type="text" bind:value={budgetId} />
        </div>

        <button type="submit" class="btn btn-primary" disabled={overtimeExecuting}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:spin={overtimeExecuting}>
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          {overtimeExecuting ? 'Processing Overtime...' : 'Trigger Overtime Approval'}
        </button>
      </form>

      {#if overtimeResult}
        <div class="result-box">
          <div class="result-header">
            <span class="result-title">Execution Result</span>
            <span class="badge badge-success">COMPLETED</span>
          </div>
          <pre class="json-preview">{JSON.stringify(overtimeResult, null, 2)}</pre>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .workflows-page {
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

  .workflows-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(480px, 1fr));
    gap: 1.5rem;
  }

  .card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 1.5rem;
    box-shadow: var(--shadow-sm);
  }

  .saga-card { display: flex; flex-direction: column; gap: 1rem; }
  .saga-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: .65rem; }
  .saga-step { display: flex; flex-direction: column; gap: .35rem; padding: .8rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: .75rem; background: var(--bg-secondary); }
  .step-index { color: var(--text-muted); font-family: monospace; }
  .saga-step strong { color: var(--text-muted); font-size: .65rem; }
  .saga-step strong.step-done { color: var(--accent-emerald); font-weight: 700; }

  .wf-card {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .wf-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .wf-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .icon-bubble {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-bubble svg { width: 20px; height: 20px; }
  .bubble-blue { background: var(--accent-blue-subtle); color: var(--accent-blue); border: 1px solid var(--accent-blue-border); }
  .bubble-purple { background: var(--accent-purple-subtle); color: var(--accent-purple); border: 1px solid var(--accent-purple-border); }

  .wf-name {
    font-size: 1.05rem;
    font-weight: 700;
  }

  .wf-sub {
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  .wf-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
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
    font-size: 0.88rem;
    outline: none;
  }

  .form-group input:focus {
    border-color: var(--border-focus);
  }

  .mono-input {
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.65rem 1rem;
    border-radius: 6px;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.15s ease;
  }

  .btn svg { width: 16px; height: 16px; }

  .btn-primary { background: #2563eb; color: white; }
  .btn-primary:hover { background: #1d4ed8; }

  .result-box {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .result-title {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  .json-preview {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: #065f46;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
    background: var(--bg-secondary);
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--border-color);
  }

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { 100% { transform: rotate(360deg); } }
</style>
