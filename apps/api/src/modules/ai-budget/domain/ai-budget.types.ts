export interface AiUsageRecord {
  id: string;
  tenantId: string;
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
  tenantId: string;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  perTransactionBudgetUsd: number;
  perAgentDailyBudgetUsd: number;
  createdAt: string;
  updatedAt: string;
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
