import type { AiUsageRecord, TenantAiBudget } from './ai-budget.types';

export interface IAiBudgetRepository {
  createUsageRecord(record: AiUsageRecord): Promise<AiUsageRecord>;
  findUsageSince(tenantId: string, since: Date, agentName?: string): Promise<AiUsageRecord[]>;

  findBudget(tenantId: string): Promise<TenantAiBudget | null>;
  upsertBudget(budget: TenantAiBudget): Promise<TenantAiBudget>;
}

export const AI_BUDGET_REPOSITORY = 'AI_BUDGET_REPOSITORY';
