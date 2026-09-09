export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    tenantId?: string;
    timestamp?: string;
    requestId?: string;
  };
}

export type AgentAvailability = 'ACTIVE' | 'DEGRADED' | 'MAINTENANCE' | 'OFFLINE';

export interface TrustProfile {
  id?: string;
  tenantId?: string;
  agentRegistrationId?: string;
  accuracy: number;
  consistency: number;
  calibration: number;
  historicalSuccessRate: number;
  failureRate: number;
  policyViolations: number;
  overallTrust: number;
  sampleCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentRegistration {
  id: string;
  tenantId: string;
  agentName: string;
  version: string;
  model: string;
  capabilities: string[];
  availability: AgentAvailability;
  costPerCall: number;
  trustProfile?: TrustProfile;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegisterAgentDto {
  agentName: string;
  version: string;
  model: string;
  capabilities: string[];
  availability?: AgentAvailability;
  costPerCall?: number;
}

export interface AiBudgetStatus {
  tenantId: string;
  dailyUsedUsd: number;
  dailyRemainingUsd: number;
  monthlyUsedUsd: number;
  monthlyRemainingUsd: number;
  isDailyExceeded: boolean;
  isMonthlyExceeded: boolean;
}

export interface AgentUsageBreakdown {
  agentName: string;
  model: string;
  dailySpent: number;
  dailyLimit: number;
  tokens: number;
  calls: number;
  avgLatencyMs: number;
}

export interface TenantAiBudget {
  id: string;
  tenantId: string;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  perTransactionBudgetUsd: number;
  perAgentDailyBudgetUsd: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SetBudgetDto {
  dailyBudgetUsd?: number;
  monthlyBudgetUsd?: number;
  perTransactionBudgetUsd?: number;
  perAgentDailyBudgetUsd?: number;
}

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TicketStatus =
  | 'OPEN'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'ESCALATED'
  | 'HUMAN_REVIEW'
  | 'RESOLVED'
  | 'CLOSED';

export interface Ticket {
  id: string;
  tenantId: string;
  workflowId?: string;
  title: string;
  description?: string;
  source: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketComment {
  id: string;
  tenantId: string;
  ticketId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface TicketAssignment {
  id: string;
  tenantId: string;
  ticketId: string;
  assigneeId: string;
  assignedBy?: string;
  assignedAt: string;
}

export interface TicketSla {
  id: string;
  tenantId: string;
  ticketId: string;
  responseDueAt: string;
  resolutionDueAt: string;
  respondedAt?: string;
  resolvedAt?: string;
  responseBreached: boolean;
  resolutionBreached: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TicketWithDetails extends Ticket {
  comments: TicketComment[];
  assignments: TicketAssignment[];
  sla?: TicketSla;
}

export interface AddCommentDto {
  authorId: string;
  body: string;
}

export interface AssignTicketDto {
  assigneeId: string;
  assignedBy?: string;
}

export interface AttachSlaDto {
  responseDueInMinutes: number;
  resolutionDueInMinutes: number;
}

export type ExperimentMode =
  | 'DETERMINISTIC'
  | 'SINGLE_AGENT'
  | 'MULTI_AGENT'
  | 'ORCHESTRATED'
  | 'PROPOSED';

export interface ScenarioDefinition {
  scenarioType: string;
  parameters: Record<string, unknown>;
  expectedOutcomes: Record<string, unknown>;
  constraints?: Record<string, unknown>;
}

export interface ExperimentScenario {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  scenarioType: string;
  definition: ScenarioDefinition;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScenarioDto {
  name: string;
  description?: string;
  scenarioType: string;
  definition: ScenarioDefinition;
}

export interface RunExperimentDto {
  mode: ExperimentMode;
  configurationId?: string;
  budgetUsd?: number;
}

export interface ExperimentRun {
  id: string;
  tenantId: string;
  scenarioId: string;
  mode: ExperimentMode;
  configurationId?: string;
  status: string;
  success: boolean;
  durationMs: number;
  tokenCount: number;
  aiCostUsd: number;
  conflictCount: number;
  escalationCount: number;
  output?: Record<string, unknown>;
  errorMessage?: string;
  budgetUsd: number;
  replayedFromRunId?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ExperimentComparison {
  scenarioId: string;
  baselineRunId: string;
  candidateRunId: string;
  successDelta: number;
  durationDeltaMs: number;
  tokenDelta: number;
  aiCostDeltaUsd: number;
  conflictDelta: number;
  escalationDelta: number;
}

export interface ProcessOrderFulfillmentDto {
  salesOrderId: string;
  warehouseId: string;
  idempotencyKey?: string;
}

export interface EnterpriseSagaDto {
  flashSaleId?: string;
  orderVolume?: number;
  warehouseId?: string;
  budgetId?: string;
}

export interface SandboxedReplayDto {
  runId: string;
  baselineRunId?: string;
  sandboxTenantId?: string;
}

export interface ProcessOvertimeApprovalDto {
  overtimeRequestId: string;
  employeeId: string;
  budgetId?: string;
}

export interface BusinessObservabilitySnapshot {
  totalAuditEvents: number;
  actionsByType: Record<string, number>;
  failureCount: number;
  successCount: number;
}

export interface AiObservabilitySnapshot {
  agentCount: number;
  averageTrustScore: number;
  totalAiCalls: number;
  totalTokensUsed: number;
  budgetExceededCount: number;
  circuitBreakerTriggeredCount: number;
  escalationCount: number;
}

export interface InfrastructureObservabilitySnapshot {
  totalScalingEvents: number;
  executedScalingEvents: number;
  rejectedScalingEvents: number;
  escalatedScalingEvents: number;
  failedScalingEvents: number;
}

export interface ObservabilitySnapshot {
  tenantId: string;
  business: BusinessObservabilitySnapshot;
  ai: AiObservabilitySnapshot;
  infrastructure: InfrastructureObservabilitySnapshot;
  capturedAt: string;
}

export interface RequestContextHeaders {
  actorId?: string;
  roles?: string;
  permissions?: string;
  tenantId?: string;
}
export type TenantContextHeaders = RequestContextHeaders;

export interface EventStreamEvent {
  action: string;
  tenantId: string;
  actor: unknown;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export type EventStreamListener = (event: EventStreamEvent) => void;

class ApiClient {
  private baseUrl: string;
  private tenantContext: TenantContextHeaders;

  constructor() {
    this.baseUrl = (typeof globalThis !== 'undefined' && (globalThis as any).__AE_RUNTIME_CONFIG__?.apiBaseUrl)
      || (typeof process !== 'undefined' && process.env?.PUBLIC_API_URL)
      || (typeof import.meta !== 'undefined' && (import.meta as any).env?.PUBLIC_API_URL)
      || 'http://localhost:3000/api/v1';

    this.tenantContext = {
      actorId: 'usr-admin-01',
      roles: 'ADMIN,TENANT_ADMIN,AI_ORCHESTRATOR,OPERATOR',
      permissions: '*'
    };
  }

  public setTenantContext(context: Partial<TenantContextHeaders>): void {
    this.tenantContext = {
      ...this.tenantContext,
      ...context
    };
  }

  public getTenantContext(): TenantContextHeaders {
    return { ...this.tenantContext };
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public subscribeToEvents(onEvent: EventStreamListener): () => void {
    return this.listenToEventStream(onEvent);
  }

  public listenToEventStream(onEventOrTenant?: string | EventStreamListener, maybeOnEvent?: EventStreamListener): () => void {
    const onEvent = (typeof onEventOrTenant === 'function' ? onEventOrTenant : maybeOnEvent)!;
    const url = `${this.baseUrl.replace(/\/$/, '')}/events/stream`;
    const source = new EventSource(url);
    const handleEvent = (message: MessageEvent<string>) => {
      try {
        onEvent(JSON.parse(message.data) as EventStreamEvent);
      } catch {
        return;
      }
    };
    source.addEventListener('message', handleEvent);
    source.onopen = () => undefined;
    source.onerror = () => undefined;
    return () => {
      source.removeEventListener('message', handleEvent);
      source.close();
    };
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
    } = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl.replace(/\/$/, '')}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.tenantContext.actorId ? { 'x-actor-id': this.tenantContext.actorId } : {}),
      ...(this.tenantContext.roles ? { 'x-actor-roles': this.tenantContext.roles } : {}),
      ...(this.tenantContext.permissions ? { 'x-actor-permissions': this.tenantContext.permissions } : {}),
      ...(options.headers || {})
    };

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      const json = await response.json();
      return json as ApiResponse<T>;
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: 'NETWORK_OR_SERVER_ERROR',
          message: err?.message || 'Failed to reach backend API'
        },
        metadata: {
          tenantId: this.tenantContext.tenantId,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // Observability
  async getObservabilitySnapshot(): Promise<ApiResponse<ObservabilitySnapshot>> {
    return this.request<ObservabilitySnapshot>('/observability/snapshot');
  }

  // Agent Registry
  async listAgents(): Promise<ApiResponse<AgentRegistration[]>> {
    return this.request<AgentRegistration[]>('/agent-registry');
  }

  async getAgent(name: string): Promise<ApiResponse<AgentRegistration>> {
    return this.request<AgentRegistration>(`/agent-registry/${encodeURIComponent(name)}`);
  }

  async registerAgent(dto: RegisterAgentDto): Promise<ApiResponse<AgentRegistration>> {
    return this.request<AgentRegistration>('/agent-registry', {
      method: 'POST',
      body: dto
    });
  }

  async updateAvailability(name: string, status: AgentAvailability): Promise<ApiResponse<AgentRegistration>> {
    return this.request<AgentRegistration>(`/agent-registry/${encodeURIComponent(name)}/availability`, {
      method: 'POST',
      body: { availability: status }
    });
  }

  // Business Modules — live record verification
  async listSalesOrders(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/sales/orders');
  }

  async listCustomers(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/sales/customers');
  }

  async listProducts(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/inventory/products');
  }

  async listWarehouses(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/inventory/warehouses');
  }

  async listStockReservations(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/inventory/reservations');
  }

  async listStockMovements(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/inventory/movements');
  }

  async getClusterSnapshot(): Promise<ApiResponse<any>> {
    return this.request<any>('/infrastructure/cluster-snapshot');
  }

  async listScalingEvents(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/infrastructure/scaling-events');
  }

  async listEmployees(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/hris/employees');
  }

  async listDepartments(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/hris/departments');
  }

  // Sales performance — channels & rep KPI
  async listSalesReps(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/sales/reps');
  }

  async getSalesRepKpis(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/sales/reps/kpi');
  }

  async getChannelSummary(): Promise<ApiResponse<any>> {
    return this.request<any>('/sales/channels/summary');
  }

  // Operations — fulfilment & workforce
  async listDeliveries(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/hris/deliveries');
  }

  async listOvertimeRequests(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/hris/overtime');
  }

  // AI FinOps / Budget
  async getBudgetStatus(): Promise<ApiResponse<AiBudgetStatus>> {
    return this.request<AiBudgetStatus>('/ai-budget/status');
  }

  async getAgentUsageBreakdown(): Promise<ApiResponse<AgentUsageBreakdown[]>> {
    return this.request<AgentUsageBreakdown[]>('/ai-budget/agent-usage');
  }

  async configureBudget(dto: SetBudgetDto): Promise<ApiResponse<TenantAiBudget>> {
    return this.request<TenantAiBudget>('/ai-budget/configure', {
      method: 'POST',
      body: dto
    });
  }

  // Ticketing
  async listTickets(status?: string): Promise<ApiResponse<Ticket[]>> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<Ticket[]>(`/tickets${query}`);
  }

  async getTicketDetails(id: string): Promise<ApiResponse<TicketWithDetails>> {
    return this.request<TicketWithDetails>(`/tickets/${encodeURIComponent(id)}/details`);
  }

  async addComment(id: string, dto: AddCommentDto): Promise<ApiResponse<TicketComment>> {
    return this.request<TicketComment>(`/tickets/${encodeURIComponent(id)}/comments`, {
      method: 'POST',
      body: dto
    });
  }

  async assignTicket(id: string, dto: AssignTicketDto): Promise<ApiResponse<TicketAssignment>> {
    return this.request<TicketAssignment>(`/tickets/${encodeURIComponent(id)}/assign`, {
      method: 'POST',
      body: dto
    });
  }

  async attachSla(id: string, dto: AttachSlaDto): Promise<ApiResponse<TicketSla>> {
    return this.request<TicketSla>(`/tickets/${encodeURIComponent(id)}/sla`, {
      method: 'POST',
      body: dto
    });
  }

  // Experiments
  async listScenarios(): Promise<ApiResponse<ExperimentScenario[]>> {
    return this.request<ExperimentScenario[]>('/experiments/scenarios');
  }

  async createScenario(dto: CreateScenarioDto): Promise<ApiResponse<ExperimentScenario>> {
    return this.request<ExperimentScenario>('/experiments/scenarios', {
      method: 'POST',
      body: dto
    });
  }

  async runExperiment(scenarioId: string, dto: RunExperimentDto): Promise<ApiResponse<ExperimentRun>> {
    return this.request<ExperimentRun>(`/experiments/scenarios/${encodeURIComponent(scenarioId)}/runs`, {
      method: 'POST',
      body: dto
    });
  }

  async replayRun(runId: string): Promise<ApiResponse<ExperimentRun>> {
    return this.request<ExperimentRun>(`/experiments/runs/${encodeURIComponent(runId)}/replay`, {
      method: 'POST'
    });
  }

  async runSandboxedReplay(dto: SandboxedReplayDto): Promise<ApiResponse<any>> {
    return this.request<any>('/experiments/sandboxed-replay', { method: 'POST', body: dto });
  }

  async compareRuns(baseId: string, candId: string): Promise<ApiResponse<ExperimentComparison>> {
    return this.request<ExperimentComparison>(
      `/experiments/compare?baselineRunId=${encodeURIComponent(baseId)}&candidateRunId=${encodeURIComponent(candId)}`
    );
  }

  // Workflows
  async triggerOrderFulfillment(dto: ProcessOrderFulfillmentDto): Promise<ApiResponse<any>> {
    return this.request<any>('/workflows/order-fulfillment', {
      method: 'POST',
      body: dto
    });
  }

  async triggerOvertimeApproval(dto: ProcessOvertimeApprovalDto): Promise<ApiResponse<any>> {
    return this.request<any>('/workflows/overtime-approval', {
      method: 'POST',
      body: dto
    });
  }

  async triggerEnterpriseSaga(dto: EnterpriseSagaDto): Promise<ApiResponse<any>> {
    return this.request<any>('/workflows/enterprise-saga', { method: 'POST', body: dto });
  }

  // Simulator & Rate-Limit Supervisor
  async getSimulatorStatus(): Promise<ApiResponse<{
    isRunning: boolean;
    mode: 'NORMAL' | 'FLASH_SALE' | 'CHAOS';
    intervalMs: number;
    totalTicks: number;
    successfulActions: number;
    failedActions: number;
    pausedByRateLimit: boolean;
    rateLimitCooldownSeconds: number;
    lastAction?: string;
    lastActor?: string;
    lastSpeechBubble?: string;
    lastTimestamp?: string;
  }>> {
    return this.request<any>('/simulator/status');
  }

  async startSimulator(config?: { mode?: string; intervalMs?: number; autoAiReasoning?: boolean }): Promise<ApiResponse<any>> {
    return this.request<any>('/simulator/start', { method: 'POST', body: config });
  }

  async stopSimulator(): Promise<ApiResponse<any>> {
    return this.request<any>('/simulator/stop', { method: 'POST' });
  }

  async updateSimulatorConfig(config: { mode?: string; intervalMs?: number; autoAiReasoning?: boolean }): Promise<ApiResponse<any>> {
    return this.request<any>('/simulator/config', { method: 'POST', body: config });
  }

  async pauseSimulatorCooldown(seconds = 30, reason = 'Operator manual rate-limit pause'): Promise<ApiResponse<any>> {
    return this.request<any>('/simulator/pause-cooldown', { method: 'POST', body: { seconds, reason } });
  }

  async resumeSimulatorCooldown(): Promise<ApiResponse<any>> {
    return this.request<any>('/simulator/resume', { method: 'POST' });
  }

  // ---------------------------------------------------------------------------
  // Write operations
  //
  // Each method mirrors the DTO declared by the corresponding NestJS controller.
  // Field names must match exactly: the API validates them server-side and
  // rejects a mismatch with a 400 rather than silently ignoring it.
  // ---------------------------------------------------------------------------

  // Sales
  async createCustomer(dto: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/sales/customers', { method: 'POST', body: dto });
  }

  async createSalesOrder(dto: {
    customerId: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number; discount?: number }>;
    discountAmount?: number;
    notes?: string;
    channel?: 'MARKETPLACE' | 'DIRECT_SALES';
    assignedRepId?: string;
    idempotencyKey?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/sales/orders', { method: 'POST', body: dto });
  }

  async updateSalesOrderStatus(id: string, status: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/sales/orders/${id}/status`, { method: 'PATCH', body: { status } });
  }

  async createSalesRep(dto: {
    fullName: string;
    email: string;
    territory?: string;
    quotaMonthlyUsd?: number;
    employeeId?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/sales/reps', { method: 'POST', body: dto });
  }

  async assignLead(orderId: string, repId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/sales/leads/${orderId}/assign`, { method: 'PATCH', body: { repId } });
  }

  async closeLead(orderId: string, outcome: 'WON' | 'LOST', lostReason?: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/sales/leads/${orderId}/close`, {
      method: 'PATCH',
      body: { outcome, lostReason }
    });
  }

  // Inventory
  async createProduct(dto: {
    sku: string;
    name: string;
    price: number;
    description?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/inventory/products', { method: 'POST', body: dto });
  }

  async createWarehouse(dto: { code: string; name: string; location?: string }): Promise<ApiResponse<any>> {
    return this.request<any>('/inventory/warehouses', { method: 'POST', body: dto });
  }

  async setStock(dto: {
    warehouseId: string;
    productId: string;
    quantity: number;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/inventory/stock', { method: 'POST', body: dto });
  }

  async reserveStock(dto: {
    warehouseId: string;
    productId: string;
    quantity: number;
    idempotencyKey?: string;
    expiresAt?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/inventory/reservations', { method: 'POST', body: dto });
  }

  async cancelReservation(id: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/inventory/reservations/${id}/cancel`, { method: 'POST' });
  }

  async createReorderRule(dto: {
    warehouseId: string;
    productId: string;
    minQuantity: number;
    reorderQuantity: number;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/inventory/reorder-rules', { method: 'POST', body: dto });
  }

  // HRIS
  async createDepartment(name: string): Promise<ApiResponse<any>> {
    return this.request<any>('/hris/departments', { method: 'POST', body: { name } });
  }

  async createEmployee(dto: {
    departmentId: string;
    fullName: string;
    email: string;
    position: string;
    hourlyRate: number;
    status?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/hris/employees', { method: 'POST', body: dto });
  }

  async requestOvertime(dto: {
    employeeId: string;
    date: string;
    hours: number;
    reason?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/hris/overtime', { method: 'POST', body: dto });
  }

  async approveOvertime(id: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/hris/overtime/${id}/approve`, { method: 'POST' });
  }

  async rejectOvertime(id: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/hris/overtime/${id}/reject`, { method: 'POST' });
  }

  async requestLeave(dto: {
    employeeId: string;
    type: string;
    startDate: string;
    endDate: string;
    reason?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/hris/leaves', { method: 'POST', body: dto });
  }

  async recordAttendance(dto: {
    employeeId: string;
    date?: string;
    clockIn?: string;
    clockOut?: string;
    status?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/hris/attendance', { method: 'POST', body: dto });
  }

  /**
   * Triggers the HRIS capacity assessment. This is the most agent-like HRIS
   * endpoint: it computes utilisation, assigns couriers to unshipped orders,
   * raises overtime requests when overloaded, and escalates a ticket when the
   * situation is critical — all as real writes.
   */
  async assessStaffing(
    departmentId: string,
    dto: {
      pendingOrders: number;
      ordersReadyToShip?: Array<{ orderId: string; orderNumber: string }>;
    }
  ): Promise<ApiResponse<any>> {
    return this.request<any>(`/hris/departments/${departmentId}/assess-staffing`, {
      method: 'POST',
      body: dto
    });
  }

  async listOvertime(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/hris/overtime');
  }

  // Finance
  async createCostCenter(dto: { name: string; code: string }): Promise<ApiResponse<any>> {
    return this.request<any>('/finance/cost-centers', { method: 'POST', body: dto });
  }

  async createBudget(dto: {
    name: string;
    totalAmount: number;
    period: string;
    costCenterId?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/finance/budgets', { method: 'POST', body: dto });
  }

  async createBudgetAllocation(dto: {
    budgetId: string;
    amount: number;
    purpose: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/finance/budget-allocations', { method: 'POST', body: dto });
  }

  async createExpense(dto: {
    amount: number;
    description: string;
    requestedBy: string;
    budgetId?: string;
    costCenterId?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/finance/expenses', { method: 'POST', body: dto });
  }

  async approveExpense(id: string, approvedBy: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/finance/expenses/${id}/approve`, { method: 'POST', body: { approvedBy } });
  }

  async rejectExpense(id: string, approvedBy: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/finance/expenses/${id}/reject`, { method: 'POST', body: { approvedBy } });
  }

  async listBudgets(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/finance/budgets');
  }

  async listCostCenters(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/finance/cost-centers');
  }

  async listExpenses(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/finance/expenses');
  }

  // Accounting
  async createChartOfAccount(dto: { code: string; name: string; type: string }): Promise<ApiResponse<any>> {
    return this.request<any>('/accounting/chart-of-accounts', { method: 'POST', body: dto });
  }

  async createJournal(dto: {
    reference: string;
    description?: string;
    entries: Array<{ accountId: string; direction: 'DEBIT' | 'CREDIT'; amount: number; memo?: string }>;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/accounting/journals', { method: 'POST', body: dto });
  }

  async postJournal(id: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/accounting/journals/${id}/post`, { method: 'POST', body: {} });
  }

  async reverseJournal(id: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/accounting/journals/${id}/reverse`, { method: 'POST', body: {} });
  }

  async createInvoice(dto: {
    type: 'RECEIVABLE' | 'PAYABLE';
    counterparty: string;
    amount: number;
    referenceId?: string;
    dueDate?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/accounting/invoices', { method: 'POST', body: dto });
  }

  async issueInvoice(id: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/accounting/invoices/${id}/issue`, { method: 'POST', body: {} });
  }

  async recordPayment(dto: {
    invoiceId: string;
    amount: number;
    method?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/accounting/payments', { method: 'POST', body: dto });
  }

  async listChartOfAccounts(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/accounting/chart-of-accounts');
  }

  async listJournals(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/accounting/journals');
  }

  async listInvoices(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/accounting/invoices');
  }

  async listPayments(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/accounting/payments');
  }

  // Procurement
  async createSupplier(dto: {
    name: string;
    contactEmail?: string;
    contactPhone?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/procurement/suppliers', { method: 'POST', body: dto });
  }

  async verifySupplier(id: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/procurement/suppliers/${id}/verify`, { method: 'PATCH', body: {} });
  }

  async createPurchaseRequest(dto: {
    requestedBy: string;
    productId: string;
    quantity: number;
    reason?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/procurement/purchase-requests', { method: 'POST', body: dto });
  }

  async approvePurchaseRequest(id: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/procurement/purchase-requests/${id}/approve`, { method: 'PATCH', body: {} });
  }

  async createPurchaseOrder(dto: {
    supplierId: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    purchaseRequestId?: string;
    idempotencyKey?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/procurement/purchase-orders', { method: 'POST', body: dto });
  }

  async approvePurchaseOrder(id: string, notes?: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/procurement/purchase-orders/${id}/approve`, {
      method: 'PATCH',
      body: { notes }
    });
  }

  async recordGoodsReceipt(dto: {
    purchaseOrderId: string;
    receivedQuantity: number;
    warehouseId: string;
    receivedAt?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/procurement/goods-receipts', { method: 'POST', body: dto });
  }

  async listSuppliers(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/procurement/suppliers');
  }

  async listPurchaseRequests(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/procurement/purchase-requests');
  }

  async listPurchaseOrders(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/procurement/purchase-orders');
  }

  // Ticketing
  async createTicket(dto: {
    title: string;
    source: string;
    description?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    workflowId?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/tickets', { method: 'POST', body: dto });
  }

  async updateTicketStatus(id: string, status: string, assignedTo?: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/tickets/${id}/status`, { method: 'PATCH', body: { status, assignedTo } });
  }

  // Knowledge
  async createKnowledgeDocument(dto: {
    sourceType: string;
    title: string;
    content: string;
    tags?: string[];
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/knowledge/documents', { method: 'POST', body: dto });
  }

  async searchKnowledge(dto: {
    query: string;
    sourceType?: string;
    limit?: number;
    minScore?: number;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/knowledge/search', { method: 'POST', body: dto });
  }

  async listKnowledgeDocuments(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/knowledge/documents');
  }

  // Infrastructure
  async requestScaling(dto: {
    namespace: string;
    deploymentName: string;
    toReplicas: number;
    reason: string;
    projectedCostUsd: number;
    budgetId?: string;
    confidence?: number;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/infrastructure/scaling-requests', { method: 'POST', body: dto });
  }

  async rollbackScaling(id: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/infrastructure/scaling-events/${id}/rollback`, { method: 'POST' });
  }

  // Orchestrator
  async executeGoal(dto: {
    goal: string;
    agentName: string;
    complexity: 'SIMPLE_QUERY' | 'SIMPLE_CLASSIFICATION' | 'COMPLEX_REASONING' | 'CRITICAL_DECISION';
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    trustRequirement?: number;
    minConfidence?: number;
    maxIterations?: number;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/orchestrator/goals', { method: 'POST', body: dto });
  }
}

export const api = new ApiClient();
