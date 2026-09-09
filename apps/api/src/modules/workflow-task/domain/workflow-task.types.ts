export type WorkflowTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'AWAITING_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'ESCALATED'
  | 'CANCELLED'
  | 'TIMED_OUT';

export interface WorkflowTask {
  id: string;
  workflowId: string;
  taskType: string;
  status: WorkflowTaskStatus;
  maxIterations?: number;
  iterationCount?: number;
  tokenBudget?: number;
  tokenUsed?: number;
  timeBudgetMs?: number;
  minConfidence?: number;
  confidence?: number;
  deadline?: string;
  payload?: unknown;
  result?: unknown;
  idempotencyKey?: string;
  escalationTicketId?: string;
  createdAt: string;
  updatedAt: string;
}
