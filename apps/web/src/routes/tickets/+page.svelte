<script lang="ts">
  import { onMount } from 'svelte';
  import {
    api,
    type Ticket,
    type TicketWithDetails,
    type TicketPriority,
    type TicketStatus,
    type AddCommentDto,
    type AssignTicketDto,
    type AttachSlaDto
  } from '$lib/api';

  let tickets = $state<Ticket[]>([
    {
      id: 'tkt-001',
      tenantId: 'tenant-corp',
      workflowId: 'wf-ord-892',
      title: 'High-Value Order Discount Escalation (>25%)',
      description: 'SalesNegotiatorAgent requested a 28% discount on enterprise order SO-9941 amounting to $48,000.',
      source: 'POLICY_ENGINE',
      priority: 'CRITICAL',
      status: 'HUMAN_REVIEW',
      assignedTo: 'usr-admin-01',
      createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString()
    },
    {
      id: 'tkt-002',
      tenantId: 'tenant-corp',
      workflowId: 'wf-inv-311',
      title: 'Stock Outlier Detected in Warehouse EU-CENTRAL',
      description: 'Inventory discrepancy detected during batch replenishment cycle. Reorder qty exceeds normal threshold.',
      source: 'CIRCUIT_BREAKER',
      priority: 'HIGH',
      status: 'OPEN',
      assignedTo: undefined,
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString()
    },
    {
      id: 'tkt-003',
      tenantId: 'tenant-corp',
      workflowId: 'wf-hr-550',
      title: 'Overtime Request Policy Threshold ($1,200)',
      description: 'Employee EMP-883 submitted overtime of 16 hours over weekend requiring manager sign-off.',
      source: 'HUMAN_ESCALATION',
      priority: 'MEDIUM',
      status: 'ASSIGNED',
      assignedTo: 'mgr-hr-02',
      createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString()
    },
    {
      id: 'tkt-004',
      tenantId: 'tenant-corp',
      workflowId: 'wf-fin-109',
      title: 'Unmapped Vendor Invoice Category GL-992',
      description: 'Automated invoice extraction could not match GL account with high confidence (confidence: 0.62).',
      source: 'AI_ORCHESTRATOR',
      priority: 'LOW',
      status: 'RESOLVED',
      assignedTo: 'usr-admin-01',
      createdAt: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
    }
  ]);

  let selectedTicketId = $state<string | null>('tkt-001');
  let selectedTicketDetails = $state<TicketWithDetails | null>({
    id: 'tkt-001',
    tenantId: 'tenant-corp',
    workflowId: 'wf-ord-892',
    title: 'High-Value Order Discount Escalation (>25%)',
    description: 'SalesNegotiatorAgent requested a 28% discount on enterprise order SO-9941 amounting to $48,000. Current policy limit is 20% before requiring human supervisor approval.',
    source: 'POLICY_ENGINE',
    priority: 'CRITICAL',
    status: 'HUMAN_REVIEW',
    assignedTo: 'usr-admin-01',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    comments: [
      {
        id: 'c-1',
        tenantId: 'tenant-corp',
        ticketId: 'tkt-001',
        authorId: 'AI_ORCHESTRATOR',
        body: 'Policy violation triggered: Rule [MAX_DISCOUNT_PERCENT=20%]. Escalating to Human-in-the-Loop review queue.',
        createdAt: new Date(Date.now() - 1000 * 60 * 44).toISOString()
      },
      {
        id: 'c-2',
        tenantId: 'tenant-corp',
        ticketId: 'tkt-001',
        authorId: 'usr-admin-01',
        body: 'Reviewing customer historical LTV. Client has $250k annual contract, discount justifiable.',
        createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString()
      }
    ],
    assignments: [
      {
        id: 'as-1',
        tenantId: 'tenant-corp',
        ticketId: 'tkt-001',
        assigneeId: 'usr-admin-01',
        assignedBy: 'AI_ORCHESTRATOR',
        assignedAt: new Date(Date.now() - 1000 * 60 * 40).toISOString()
      }
    ],
    sla: {
      id: 'sla-1',
      tenantId: 'tenant-corp',
      ticketId: 'tkt-001',
      responseDueAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      resolutionDueAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      respondedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      responseBreached: false,
      resolutionBreached: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString()
    }
  });

  let filterPriority = $state<string>('ALL');
  let filterStatus = $state<string>('ALL');
  let loading = $state(false);
  let newCommentText = $state('');
  let assignInput = $state('usr-admin-01');
  let slaResponseMins = $state(30);
  let slaResolutionMins = $state(120);

  async function loadTickets() {
    loading = true;
    try {
      const res = await api.listTickets(filterStatus !== 'ALL' ? filterStatus : undefined);
      if (res.success && res.data && res.data.length > 0) {
        tickets = res.data;
      }
    } catch (err) {
      console.error(err);
    } finally {
      loading = false;
    }
  }

  async function selectTicket(tkt: Ticket) {
    selectedTicketId = tkt.id;
    try {
      const res = await api.getTicketDetails(tkt.id);
      if (res.success && res.data) {
        selectedTicketDetails = res.data;
      } else {
        selectedTicketDetails = {
          ...tkt,
          comments: selectedTicketDetails?.id === tkt.id ? selectedTicketDetails.comments : [],
          assignments: selectedTicketDetails?.id === tkt.id ? selectedTicketDetails.assignments : [],
          sla: selectedTicketDetails?.id === tkt.id ? selectedTicketDetails.sla : undefined
        };
      }
    } catch {
      selectedTicketDetails = {
        ...tkt,
        comments: [],
        assignments: []
      };
    }
  }

  async function handleAddComment(e: Event) {
    e.preventDefault();
    if (!newCommentText.trim() || !selectedTicketId) return;

    const dto: AddCommentDto = {
      authorId: 'usr-admin-01',
      body: newCommentText.trim()
    };

    try {
      await api.addComment(selectedTicketId, dto);
    } catch (e) {
      console.error(e);
    }

    if (selectedTicketDetails) {
      selectedTicketDetails.comments = [
        ...selectedTicketDetails.comments,
        {
          id: `c-${Date.now()}`,
          tenantId: 'tenant-corp',
          ticketId: selectedTicketId,
          authorId: dto.authorId,
          body: dto.body,
          createdAt: new Date().toISOString()
        }
      ];
    }
    newCommentText = '';
  }

  async function handleAssignTicket() {
    if (!selectedTicketId || !assignInput.trim()) return;
    const dto: AssignTicketDto = {
      assigneeId: assignInput.trim(),
      assignedBy: 'usr-admin-01'
    };

    try {
      await api.assignTicket(selectedTicketId, dto);
    } catch (e) {
      console.error(e);
    }

    tickets = tickets.map(t => t.id === selectedTicketId ? { ...t, assignedTo: dto.assigneeId, status: 'ASSIGNED' } : t);
    if (selectedTicketDetails) {
      selectedTicketDetails.assignedTo = dto.assigneeId;
      selectedTicketDetails.status = 'ASSIGNED';
      selectedTicketDetails.assignments = [
        ...selectedTicketDetails.assignments,
        {
          id: `as-${Date.now()}`,
          tenantId: 'tenant-corp',
          ticketId: selectedTicketId,
          assigneeId: dto.assigneeId,
          assignedBy: dto.assignedBy,
          assignedAt: new Date().toISOString()
        }
      ];
    }
  }

  async function handleAttachSla() {
    if (!selectedTicketId) return;
    const dto: AttachSlaDto = {
      responseDueInMinutes: Number(slaResponseMins),
      resolutionDueInMinutes: Number(slaResolutionMins)
    };

    try {
      await api.attachSla(selectedTicketId, dto);
    } catch (e) {
      console.error(e);
    }

    if (selectedTicketDetails) {
      selectedTicketDetails.sla = {
        id: `sla-${Date.now()}`,
        tenantId: 'tenant-corp',
        ticketId: selectedTicketId,
        responseDueAt: new Date(Date.now() + dto.responseDueInMinutes * 60000).toISOString(),
        resolutionDueAt: new Date(Date.now() + dto.resolutionDueInMinutes * 60000).toISOString(),
        responseBreached: false,
        resolutionBreached: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  }

  let filteredTickets = $derived(
    tickets.filter(t => {
      const matchPrio = filterPriority === 'ALL' || t.priority === filterPriority;
      const matchStat = filterStatus === 'ALL' || t.status === filterStatus;
      return matchPrio && matchStat;
    })
  );

  onMount(() => {
    loadTickets();
  });
</script>

<div class="tickets-page">
  <!-- Page Header -->
  <div class="page-header">
    <div>
      <h2 class="title">Human-in-the-Loop (HITL) Ticketing</h2>
      <p class="subtitle">Supervisory exception handling for autonomous workflow anomalies, circuit breakers, and policy breaches.</p>
    </div>
    <button class="btn btn-secondary" onclick={loadTickets} disabled={loading}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path>
      </svg>
      Refresh Queue
    </button>
  </div>

  <!-- Priority Filters -->
  <div class="filter-row">
    <div class="filter-group">
      <span class="filter-label">PRIORITY:</span>
      <div class="pill-group">
        {#each ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as prio}
          <button
            class="pill-btn"
            class:active={filterPriority === prio}
            onclick={() => { filterPriority = prio; }}
          >
            {prio}
          </button>
        {/each}
      </div>
    </div>

    <div class="filter-group">
      <span class="filter-label">STATUS:</span>
      <select bind:value={filterStatus} onchange={loadTickets} class="status-dropdown">
        <option value="ALL">All Statuses</option>
        <option value="OPEN">OPEN</option>
        <option value="ASSIGNED">ASSIGNED</option>
        <option value="HUMAN_REVIEW">HUMAN_REVIEW</option>
        <option value="RESOLVED">RESOLVED</option>
      </select>
    </div>
  </div>

  <!-- Main 2-Pane View -->
  <div class="split-view">
    <!-- Tickets List -->
    <div class="tickets-list">
      {#if filteredTickets.length === 0}
        <div class="card empty-card">
          <p>No tickets matching current filters.</p>
        </div>
      {:else}
        {#each filteredTickets as tkt}
          <div
            class="card ticket-item"
            class:selected={selectedTicketId === tkt.id}
            onclick={() => selectTicket(tkt)}
            role="button"
            tabindex="0"
            onkeydown={(e) => { if (e.key === 'Enter') selectTicket(tkt); }}
          >
            <div class="tkt-top">
              <span class="badge badge-{tkt.priority.toLowerCase()}">{tkt.priority}</span>
              <span class="tkt-status badge badge-{tkt.status.toLowerCase()}">{tkt.status}</span>
            </div>
            <h4 class="tkt-title">{tkt.title}</h4>
            <div class="tkt-meta">
              <span class="tkt-source">Source: {tkt.source}</span>
              {#if tkt.assignedTo}
                <span class="tkt-assignee">Assigned: {tkt.assignedTo}</span>
              {:else}
                <span class="tkt-unassigned text-amber">Unassigned</span>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Ticket Detail Drawer / Panel -->
    <div class="card detail-panel">
      {#if selectedTicketDetails}
        <div class="detail-header">
          <div>
            <div class="detail-badge-row">
              <span class="badge badge-{selectedTicketDetails.priority.toLowerCase()}">{selectedTicketDetails.priority}</span>
              <span class="badge badge-{selectedTicketDetails.status.toLowerCase()}">{selectedTicketDetails.status}</span>
              <span class="id-tag">{selectedTicketDetails.id}</span>
            </div>
            <h3 class="detail-title">{selectedTicketDetails.title}</h3>
          </div>
        </div>

        <div class="detail-section">
          <span class="section-label">Incident Description</span>
          <p class="description-text">{selectedTicketDetails.description || 'No description provided.'}</p>
        </div>

        <!-- SLA Card -->
        <div class="sla-box">
          <div class="sla-header">
            <span class="sla-title">Service Level Agreement (SLA)</span>
            {#if selectedTicketDetails.sla}
              <span class="sla-badge" class:sla-breached={selectedTicketDetails.sla.responseBreached || selectedTicketDetails.sla.resolutionBreached}>
                {selectedTicketDetails.sla.resolutionBreached ? 'BREACHED' : 'ON TRACK'}
              </span>
            {:else}
              <span class="sla-badge">NO SLA ATTACHED</span>
            {/if}
          </div>
          {#if selectedTicketDetails.sla}
            <div class="sla-details">
              <div>Resolution Due: <span class="mono-text">{new Date(selectedTicketDetails.sla.resolutionDueAt).toLocaleTimeString()}</span></div>
              <div>Response Due: <span class="mono-text">{new Date(selectedTicketDetails.sla.responseDueAt).toLocaleTimeString()}</span></div>
            </div>
          {:else}
            <div class="attach-sla-row">
              <input type="number" bind:value={slaResponseMins} placeholder="Resp (min)" title="Response minutes" />
              <input type="number" bind:value={slaResolutionMins} placeholder="Resol (min)" title="Resolution minutes" />
              <button class="btn btn-secondary btn-sm" onclick={handleAttachSla}>Attach SLA</button>
            </div>
          {/if}
        </div>

        <!-- Assignment Controls -->
        <div class="assignment-row">
          <span class="section-label">Assignee:</span>
          <input type="text" bind:value={assignInput} placeholder="Assignee ID" class="assign-input" />
          <button class="btn btn-secondary btn-sm" onclick={handleAssignTicket}>Reassign</button>
        </div>

        <!-- Comment Thread -->
        <div class="comments-section">
          <span class="section-label">Audit & Operator Comment Thread</span>
          <div class="comment-list">
            {#each selectedTicketDetails.comments as c}
              <div class="comment-item">
                <div class="comment-meta">
                  <span class="comment-author">{c.authorId}</span>
                  <span class="comment-time">{new Date(c.createdAt).toLocaleTimeString()}</span>
                </div>
                <div class="comment-body">{c.body}</div>
              </div>
            {/each}
          </div>

          <form onsubmit={handleAddComment} class="comment-form">
            <textarea
              bind:value={newCommentText}
              placeholder="Add human decision notes or justification for audit log..."
              rows="2"
            ></textarea>
            <button type="submit" class="btn btn-primary btn-sm">Post Comment</button>
          </form>
        </div>
      {:else}
        <div class="empty-panel">
          <p>Select a ticket from the queue to view details.</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .tickets-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
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

  .btn-sm {
    padding: 0.35rem 0.75rem;
    font-size: 0.78rem;
  }

  .btn-primary { background: #2563eb; color: white; }
  .btn-secondary { background: var(--bg-card); border-color: var(--border-color); color: var(--text-primary); }

  .filter-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    background: var(--bg-card);
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .filter-label {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.05em;
  }

  .pill-group {
    display: flex;
    gap: 0.35rem;
  }

  .pill-btn {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.6rem;
    border-radius: 4px;
    cursor: pointer;
  }

  .pill-btn.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  .status-dropdown {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.35rem 0.6rem;
    border-radius: 4px;
    font-size: 0.78rem;
    outline: none;
  }

  .split-view {
    display: grid;
    grid-template-columns: 420px 1fr;
    gap: 1.5rem;
    min-height: 600px;
  }

  @media (max-width: 960px) {
    .split-view { grid-template-columns: 1fr; }
  }

  .tickets-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 750px;
    overflow-y: auto;
  }

  .card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 1.25rem;
    box-shadow: var(--shadow-sm);
  }

  .ticket-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .ticket-item:hover {
    background: var(--bg-card-hover);
  }

  .ticket-item.selected {
    border-color: var(--accent-blue);
    background: var(--accent-blue-subtle);
  }

  .tkt-top {
    display: flex;
    justify-content: space-between;
  }

  .tkt-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.3;
  }

  .tkt-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .text-amber { color: var(--accent-amber); }

  .detail-panel {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .detail-header {
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 1rem;
  }

  .detail-badge-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .id-tag {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .detail-title {
    font-size: 1.2rem;
    font-weight: 700;
  }

  .detail-section {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .section-label {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .description-text {
    font-size: 0.88rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .sla-box {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .sla-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .sla-title {
    font-size: 0.78rem;
    font-weight: 600;
  }

  .sla-badge {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    background: var(--accent-emerald-subtle);
    color: var(--accent-emerald);
    border: 1px solid var(--accent-emerald-border);
  }

  .sla-badge.sla-breached {
    background: var(--accent-rose-subtle);
    color: var(--accent-rose);
    border: 1px solid var(--accent-rose-border);
  }

  .sla-details {
    display: flex;
    gap: 1.5rem;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .attach-sla-row {
    display: flex;
    gap: 0.5rem;
  }

  .attach-sla-row input {
    width: 100px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.78rem;
  }

  .assignment-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 0;
    border-top: 1px solid var(--border-color);
    border-bottom: 1px solid var(--border-color);
  }

  .assign-input {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.35rem 0.6rem;
    border-radius: 4px;
    font-size: 0.82rem;
    font-family: var(--font-mono);
  }

  .comments-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
  }

  .comment-list {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    max-height: 250px;
    overflow-y: auto;
  }

  .comment-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.65rem 0.85rem;
  }

  .comment-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    margin-bottom: 0.25rem;
  }

  .comment-author {
    font-weight: 700;
    color: #60a5fa;
  }

  .comment-time {
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .comment-body {
    font-size: 0.82rem;
    color: var(--text-primary);
    line-height: 1.4;
  }

  .comment-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .comment-form textarea {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    border-radius: 6px;
    padding: 0.5rem;
    font-size: 0.82rem;
    outline: none;
    resize: none;
  }

  .empty-card, .empty-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 0.88rem;
    padding: 3rem;
  }
</style>
