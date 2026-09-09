export interface TaskLimits {
  maxIterations: number;
  tokenBudget: number;
  timeBudgetMs: number;
  minConfidence: number;
}

export type TaskOutcome = 'EXECUTE' | 'ESCALATE' | 'CIRCUIT_BROKEN';

export interface ReEvaluationAttempt {
  iteration: number;
  confidence: number;
  tokenUsed: number;
  timestamp: string;
}

export interface ReEvaluationState {
  taskId: string;
  tenantId: string;
  workflowId: string;
  taskType: string;
  limits: TaskLimits;
  attempts: ReEvaluationAttempt[];
  startedAt: string;
  outcome?: TaskOutcome;
  finalConfidence?: number;
  ticketId?: string;
}

export const DEFAULT_TASK_LIMITS: TaskLimits = {
  maxIterations: 3,
  tokenBudget: 5000,
  timeBudgetMs: 10000,
  minConfidence: 0.85
};
