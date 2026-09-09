export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  TENANT_ADMIN = 'TENANT_ADMIN',
  FINANCE_MANAGER = 'FINANCE_MANAGER',
  ACCOUNTANT = 'ACCOUNTANT',
  HR_MANAGER = 'HR_MANAGER',
  PROCUREMENT_MANAGER = 'PROCUREMENT_MANAGER',
  INVENTORY_MANAGER = 'INVENTORY_MANAGER',
  SALES_MANAGER = 'SALES_MANAGER',
  OPERATOR = 'OPERATOR',
  EMPLOYEE = 'EMPLOYEE',
  AUDITOR = 'AUDITOR',
  AI_SALES_AGENT = 'AI_SALES_AGENT',
  AI_FINANCE_AGENT = 'AI_FINANCE_AGENT',
  AI_INFRA_AGENT = 'AI_INFRA_AGENT',
  AI_ORCHESTRATOR = 'AI_ORCHESTRATOR'
}

export type ActorType = 'user' | 'agent';

export interface ActorIdentity {
  id: string;
  type: ActorType;
  roles: (Role | string)[];
  permissions: string[];
}

export interface RequestContext {
  actor: ActorIdentity;
  requestId?: string;
}
export type TenantContext = RequestContext;

export interface EnterpriseConfig {
  currency: string;
  timezone: string;
  aiBudgetMonthly: number;
  humanEscalationThreshold: number;
}
export type TenantConfig = EnterpriseConfig;

export interface AgentMessageMetadata {
  confidence: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

export interface AgentMessage<T = Record<string, unknown>> {
  messageId: string;
  workflowId: string;
  sender: string;
  receiver: string;
  intent: string;
  payload: T;
  metadata: AgentMessageMetadata;
}

export interface AuditRecord {
  auditId: string;
  timestamp: string;
  actor: ActorIdentity;
  agent?: string;
  workflowId?: string;
  action: string;
  input: unknown;
  output?: unknown;
  status: 'SUCCESS' | 'FAILURE' | 'REJECTED';
  reasoning?: string;
  policyEvaluation?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    timestamp: string;
    requestId?: string;
  };
}

export enum SalesOrderStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  FULFILLED = 'FULFILLED'
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalesOrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
}

export enum SalesChannel {
  MARKETPLACE = 'MARKETPLACE',
  DIRECT_SALES = 'DIRECT_SALES'
}

export enum LeadOutcome {
  PENDING = 'PENDING',
  WON = 'WON',
  LOST = 'LOST'
}

export interface SalesOrder {
  id: string;
  customerId: string;
  orderNumber: string;
  items: SalesOrderItem[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  status: SalesOrderStatus;
  channel: SalesChannel;
  assignedRepId?: string;
  leadOutcome?: LeadOutcome;
  assignedAt?: string;
  closedAt?: string;
  lostReason?: string;
  idempotencyKey?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalesRep {
  id: string;
  employeeId?: string;
  fullName: string;
  email: string;
  territory?: string;
  quotaMonthlyUsd: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SalesRepKpi {
  repId: string;
  fullName: string;
  territory?: string;
  assignedLeads: number;
  wonDeals: number;
  lostDeals: number;
  pendingLeads: number;
  closingRate: number;
  revenueClosedUsd: number;
  quotaMonthlyUsd: number;
  quotaAttainment: number;
  avgClosingTimeMinutes: number;
  kpiScore: number;
  rating: 'A' | 'B' | 'C' | 'D';
}

export enum WorkflowStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface OutboxEvent<T = unknown> {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: T;
  status: 'PENDING' | 'PUBLISHED' | 'FAILED';
  createdAt: string;
  publishedAt?: string;
}

export interface WorkflowReservationDetail {
  reservationId: string;
  productId: string;
  quantity: number;
  warehouseId: string;
}

export interface WorkflowExecutionResult {
  workflowId: string;
  salesOrderId: string;
  status: WorkflowStatus;
  sales: {
    orderId: string;
    status: SalesOrderStatus;
  };
  inventory: {
    checked: boolean;
    reserved: boolean;
    reservations: WorkflowReservationDetail[];
  };
  idempotencyKey?: string;
  error?: string;
  timestamp: string;
}

export enum PurchaseRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CONVERTED = 'CONVERTED'
}

export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RECEIVED = 'RECEIVED',
  CANCELLED = 'CANCELLED'
}

export enum ExpenseStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID'
}

export interface Supplier {
  id: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseRequest {
  id: string;
  requestedBy: string;
  productId: string;
  quantity: number;
  status: PurchaseRequestStatus;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  purchaseRequestId?: string;
  orderNumber: string;
  status: PurchaseOrderStatus;
  totalAmount: number;
  idempotencyKey?: string;
  items?: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SupplierQuotation {
  id: string;
  supplierId: string;
  productId: string;
  unitPrice: number;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoodsReceipt {
  id: string;
  purchaseOrderId: string;
  receivedQuantity: number;
  warehouseId: string;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CostCenter {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetAllocation {
  id: string;
  budgetId: string;
  amount: number;
  purpose: string;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  costCenterId?: string;
  name: string;
  totalAmount: number;
  allocatedAmount: number;
  spentAmount: number;
  period: string;
  allocations?: BudgetAllocation[];
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  budgetId?: string;
  costCenterId?: string;
  amount: number;
  description: string;
  status: ExpenseStatus;
  requestedBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export const DomainEvents = {
  PurchaseRequestCreated: 'PurchaseRequestCreated',
  PurchaseOrderApproved: 'PurchaseOrderApproved',
  GoodsReceiptRecorded: 'GoodsReceiptRecorded',
  ExpenseApproved: 'ExpenseApproved',
  BudgetExceeded: 'BudgetExceeded'
} as const;

export type DomainEvent = typeof DomainEvents[keyof typeof DomainEvents];

export const PurchaseRequestCreated = DomainEvents.PurchaseRequestCreated;
export const PurchaseOrderApproved = DomainEvents.PurchaseOrderApproved;
export const GoodsReceiptRecorded = DomainEvents.GoodsReceiptRecorded;
export const ExpenseApproved = DomainEvents.ExpenseApproved;
export const BudgetExceeded = DomainEvents.BudgetExceeded;

export interface PurchaseRequestCreatedPayload {
  purchaseRequestId: string;
  requestedBy: string;
  productId: string;
  quantity: number;
}

export interface PurchaseOrderApprovedPayload {
  purchaseOrderId: string;
  supplierId: string;
  orderNumber: string;
  totalAmount: number;
}

export interface GoodsReceiptRecordedPayload {
  goodsReceiptId: string;
  purchaseOrderId: string;
  receivedQuantity: number;
  warehouseId: string;
  receivedAt: string;
}

export interface ExpenseApprovedPayload {
  expenseId: string;
  budgetId?: string;
  costCenterId?: string;
  amount: number;
  approvedBy: string;
}

export interface BudgetExceededPayload {
  budgetId: string;
  costCenterId?: string;
  totalAmount: number;
  spentAmount: number;
  attemptedAmount?: number;
}

export enum ChartOfAccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE'
}

export interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  type: ChartOfAccountType;
  createdAt: string;
  updatedAt: string;
}

export enum JournalStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  POSTED = 'POSTED',
  REJECTED = 'REJECTED',
  REVERSED = 'REVERSED'
}

export enum JournalEntryDirection {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT'
}

export interface JournalEntry {
  id: string;
  journalId: string;
  accountId: string;
  direction: JournalEntryDirection;
  amount: number;
  memo?: string;
  createdAt: string;
}

export interface Journal {
  id: string;
  reference: string;
  description?: string;
  status: JournalStatus;
  postedAt?: string;
  entries?: JournalEntry[];
  createdAt: string;
  updatedAt: string;
}

export enum InvoiceType {
  RECEIVABLE = 'RECEIVABLE',
  PAYABLE = 'PAYABLE'
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED'
}

export interface Invoice {
  id: string;
  type: InvoiceType;
  referenceId?: string;
  counterparty: string;
  amount: number;
  paidAmount: number;
  status: InvoiceStatus;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method?: string;
  status: PaymentStatus;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export enum WorkflowTaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  ESCALATED = 'ESCALATED',
  CANCELLED = 'CANCELLED'
}

export interface WorkflowTaskLimits {
  maxIterations: number;
  tokenBudget: number;
  timeBudgetMs: number;
  minConfidence: number;
}

export interface WorkflowTask {
  id: string;
  workflowId: string;
  taskType: string;
  status: WorkflowTaskStatus;
  maxIterations: number;
  iterationCount: number;
  tokenBudget: number;
  tokenUsed: number;
  timeBudgetMs: number;
  minConfidence: number;
  confidence?: number;
  deadline?: string;
  payload?: unknown;
  result?: unknown;
  createdAt: string;
  updatedAt: string;
}

export enum ConflictStatus {
  DETECTED = 'DETECTED',
  RESOLVED = 'RESOLVED',
  ESCALATED = 'ESCALATED'
}

export interface ConflictLog {
  id: string;
  workflowId?: string;
  partyA: string;
  partyADecision: string;
  partyB: string;
  partyBDecision: string;
  status: ConflictStatus;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum TicketStatus {
  OPEN = 'OPEN',
  TRIAGED = 'TRIAGED',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  ESCALATED = 'ESCALATED',
  HUMAN_REVIEW = 'HUMAN_REVIEW',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED'
}

export interface Ticket {
  id: string;
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

export enum AgentAvailability {
  AVAILABLE = 'AVAILABLE',
  DEGRADED = 'DEGRADED',
  UNAVAILABLE = 'UNAVAILABLE'
}

export interface AgentRegistration {
  id: string;
  agentName: string;
  version: string;
  model: string;
  capabilities: string[];
  availability: AgentAvailability;
  costPerCall: number;
  trustProfile?: TrustProfile;
  createdAt: string;
  updatedAt: string;
}

export interface TrustProfile {
  id: string;
  agentRegistrationId: string;
  accuracy: number;
  consistency: number;
  calibration: number;
  historicalSuccessRate: number;
  failureRate: number;
  policyViolations: number;
  overallTrust: number;
  sampleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiUsageRecord {
  id: string;
  workflowId?: string;
  agentName?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  actualCostUsd?: number;
  latencyMs: number;
  reevaluationCount: number;
  createdAt: string;
}

export interface TenantAiBudget {
  id: string;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  perTransactionBudgetUsd: number;
  perAgentDailyBudgetUsd: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiBudgetStatus {
  dailyUsedUsd: number;
  dailyRemainingUsd: number;
  monthlyUsedUsd: number;
  monthlyRemainingUsd: number;
  isDailyExceeded: boolean;
  isMonthlyExceeded: boolean;
}

export type TaskComplexity = 'SIMPLE_QUERY' | 'SIMPLE_CLASSIFICATION' | 'COMPLEX_REASONING' | 'CRITICAL_DECISION';

export type ModelTier = 'DETERMINISTIC' | 'SMALL_MODEL' | 'REASONING_MODEL' | 'HIGH_RELIABILITY_MODEL';

export interface ModelRoutingDecision {
  tier: ModelTier;
  model?: string;
  requiresPolicyValidation: boolean;
  requiresHumanApproval: boolean;
  reasons: string[];
}

export interface Department {
  id: string;
  name: string;
  code?: string;
  createdAt: string;
  updatedAt: string;
}

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  TERMINATED = 'TERMINATED'
}

export interface Employee {
  id: string;
  departmentId: string;
  employeeCode?: string;
  fullName: string;
  email: string;
  position: string;
  status: EmployeeStatus;
  hourlyRate?: number;
  hireDate?: string;
  createdAt: string;
  updatedAt: string;
}

export enum StaffRole {
  WAREHOUSE = 'WAREHOUSE',
  COURIER = 'COURIER',
  OTHER = 'OTHER'
}

export enum DeliveryStatus {
  ASSIGNED = 'ASSIGNED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED'
}

export interface Delivery {
  id: string;
  orderId: string;
  orderNumber: string;
  courierId: string;
  courierName: string;
  status: DeliveryStatus;
  assignedAt: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffingAssessment {
  departmentId: string;
  pendingOrders: number;
  warehouseStaff: number;
  courierStaff: number;
  warehouseCapacity: number;
  courierCapacity: number;
  warehouseUtilization: number;
  courierUtilization: number;
  activeDeliveries: number;
  unassignedOrders: number;
  severity: 'NORMAL' | 'BUSY' | 'OVERLOADED' | 'CRITICAL';
  actionsTaken: string[];
  overtimeRequestIds: string[];
  deliveryIds: string[];
  escalationTicketId?: string;
  hiringRecommendation?: string;
  assessedAt: string;
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  HALF_DAY = 'HALF_DAY'
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  status: AttendanceStatus;
  createdAt: string;
  updatedAt: string;
}

export enum LeaveType {
  ANNUAL = 'ANNUAL',
  SICK = 'SICK',
  UNPAID = 'UNPAID',
  OTHER = 'OTHER'
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

export interface Leave {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string;
  status: LeaveStatus;
  createdAt: string;
  updatedAt: string;
}

export enum OvertimeStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface OvertimeRequest {
  id: string;
  employeeId: string;
  date: string;
  hours: number;
  reason?: string;
  estimatedCost: number;
  status: OvertimeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkloadSummary {
  departmentId: string;
  employeeCount: number;
  totalOvertimeHoursLast30Days: number;
  openTicketCount: number;
  averageTicketsPerEmployee: number;
  isOverloaded: boolean;
  reasons: string[];
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface TicketAssignment {
  id: string;
  ticketId: string;
  assigneeId: string;
  assignedBy?: string;
  assignedAt: string;
}

export interface TicketSla {
  id: string;
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

export enum KnowledgeSourceType {
  SOP = 'SOP',
  COMPANY_POLICY = 'COMPANY_POLICY',
  PRODUCT_CATALOG = 'PRODUCT_CATALOG',
  FINANCIAL_POLICY = 'FINANCIAL_POLICY',
  HR_POLICY = 'HR_POLICY',
  PROCUREMENT_POLICY = 'PROCUREMENT_POLICY',
  TECHNICAL_DOCUMENTATION = 'TECHNICAL_DOCUMENTATION',
  HISTORICAL_CASE = 'HISTORICAL_CASE'
}

export interface KnowledgeDocument {
  id: string;
  sourceType: KnowledgeSourceType;
  title: string;
  content: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeSearchResult {
  query?: string;
  documents?: KnowledgeDocument[];
  scores?: number[];
  document?: KnowledgeDocument;
  score?: number;
  matchedTerms?: string[];
}

export interface ClusterNode {
  name: string;
  status: string;
  cpuCapacity: string;
  memoryCapacity: string;
  cpuAllocatable: string;
  memoryAllocatable: string;
  kubeletVersion: string;
}

export interface WorkloadPod {
  name: string;
  namespace: string;
  status: string;
  restartCount: number;
  cpuRequest?: string;
  memoryRequest?: string;
  cpuLimit?: string;
  memoryLimit?: string;
  createdAt?: string;
}

export interface WorkloadDeployment {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  availableReplicas: number;
  image: string;
}

export interface WorkloadService {
  name: string;
  namespace: string;
  type: string;
  clusterIp: string;
  ports: number[];
}

export interface ClusterSnapshot {
  clusterName: string;
  nodes: ClusterNode[];
  deployments: WorkloadDeployment[];
  pods: WorkloadPod[];
  services: WorkloadService[];
  capturedAt: string;
}

export enum ScalingAction {
  SCALE_UP = 'SCALE_UP',
  SCALE_DOWN = 'SCALE_DOWN'
}

export enum ScalingEventStatus {
  REQUESTED = 'REQUESTED',
  POLICY_APPROVED = 'POLICY_APPROVED',
  POLICY_REJECTED = 'POLICY_REJECTED',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
  ESCALATED = 'ESCALATED',
  ROLLED_BACK = 'ROLLED_BACK'
}

export interface ScalingEvent {
  id: string;
  workflowId?: string;
  clusterName: string;
  namespace: string;
  deploymentName: string;
  action: ScalingAction;
  fromReplicas: number;
  toReplicas: number;
  reason: string;
  projectedCostUsd: number;
  status: ScalingEventStatus;
  policyReasons: string[];
  executedAt?: string;
  rolledBackAt?: string;
  ticketId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloudCostRecord {
  id: string;
  clusterName: string;
  namespace: string;
  resourceName: string;
  costUsd: number;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export enum ExperimentMode {
  DETERMINISTIC = 'DETERMINISTIC',
  SINGLE_AGENT = 'SINGLE_AGENT',
  MULTI_AGENT = 'MULTI_AGENT',
  ORCHESTRATED = 'ORCHESTRATED',
  PROPOSED = 'PROPOSED'
}

export enum ExperimentStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface ScenarioDefinition {
  scenarioType: string;
  input: Record<string, unknown>;
  expectedResult?: Record<string, unknown>;
}

export interface ExperimentScenario {
  id: string;
  name: string;
  description?: string;
  scenarioType: string;
  definition: ScenarioDefinition;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentRun {
  id: string;
  scenarioId: string;
  replayOfRunId?: string;
  mode: ExperimentMode;
  status: ExperimentStatus;
  configurationId: string;
  agentVersions: Record<string, string>;
  modelVersions: Record<string, string>;
  policyVersion: string;
  budgetUsd: number;
  finalResult?: Record<string, unknown>;
  success?: boolean;
  durationMs?: number;
  tokenCount: number;
  aiCostUsd: number;
  llmCallCount: number;
  conflictCount: number;
  escalationCount: number;
  reevaluationCount: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentComparison {
  scenarioId?: string;
  baselineRunId: string;
  candidateRunId: string;
  baselineMode?: ExperimentMode;
  candidateMode?: ExperimentMode;
  successDelta?: number;
  durationDeltaMs: number;
  tokenDelta: number;
  costDeltaUsd?: number;
  aiCostDeltaUsd?: number;
  conflictDelta: number;
  escalationDelta: number;
  accuracyDelta?: number;
  verdict?: 'IMPROVED' | 'REGRESSED' | 'INCONCLUSIVE';
  metrics?: {
    durationDeltaMs: number;
    tokenDelta: number;
    costDeltaUsd: number;
    conflictDelta: number;
    escalationDelta: number;
    accuracyDelta?: number;
  };
}
