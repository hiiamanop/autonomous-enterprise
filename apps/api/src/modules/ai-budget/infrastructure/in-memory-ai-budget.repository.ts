import { Injectable } from '@nestjs/common';
import type { AiUsageRecord, TenantAiBudget } from '../domain/ai-budget.types';
import type { IAiBudgetRepository } from '../domain/ai-budget.repository.interface';

@Injectable()
export class InMemoryAiBudgetRepository implements IAiBudgetRepository {
  private usageRecords: AiUsageRecord[] = [];
  private budgets: TenantAiBudget[] = [];

  async createUsageRecord(record: AiUsageRecord): Promise<AiUsageRecord> {
    this.usageRecords.push(record);
    return record;
  }

  async findUsageSince(tenantId: string, since: Date, agentName?: string): Promise<AiUsageRecord[]> {
    return this.usageRecords.filter(
      (r) =>
        r.tenantId === tenantId &&
        new Date(r.createdAt) >= since &&
        (agentName ? r.agentName === agentName : true)
    );
  }

  async findBudget(tenantId: string): Promise<TenantAiBudget | null> {
    return this.budgets.find((b) => b.tenantId === tenantId) ?? null;
  }

  async upsertBudget(budget: TenantAiBudget): Promise<TenantAiBudget> {
    const index = this.budgets.findIndex((b) => b.tenantId === budget.tenantId);
    if (index === -1) {
      this.budgets.push(budget);
    } else {
      this.budgets[index] = budget;
    }
    return budget;
  }
}
