import type {
  PrismaClient,
  AiUsageRecord as PrismaAiUsageRecord,
  TenantAiBudget as PrismaTenantAiBudget
} from '@prisma/client';

export interface AiUsageRecordEntity {
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

export interface TenantAiBudgetEntity {
  id: string;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  perTransactionBudgetUsd: number;
  perAgentDailyBudgetUsd: number;
  createdAt: string;
  updatedAt: string;
}

export class PrismaAiBudgetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapUsage(raw: PrismaAiUsageRecord): AiUsageRecordEntity {
    return {
      id: raw.id,
      workflowId: raw.workflowId ?? undefined,
      agentName: raw.agentName ?? undefined,
      model: raw.model,
      inputTokens: raw.inputTokens,
      outputTokens: raw.outputTokens,
      totalTokens: raw.totalTokens,
      estimatedCostUsd: raw.estimatedCostUsd,
      actualCostUsd: raw.actualCostUsd ?? undefined,
      latencyMs: raw.latencyMs,
      reevaluationCount: raw.reevaluationCount,
      createdAt: raw.createdAt.toISOString()
    };
  }

  private mapBudget(raw: PrismaTenantAiBudget): TenantAiBudgetEntity {
    return {
      id: raw.id,
      dailyBudgetUsd: raw.dailyBudgetUsd,
      monthlyBudgetUsd: raw.monthlyBudgetUsd,
      perTransactionBudgetUsd: raw.perTransactionBudgetUsd,
      perAgentDailyBudgetUsd: raw.perAgentDailyBudgetUsd,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  async recordUsage(record: AiUsageRecordEntity): Promise<AiUsageRecordEntity> {
    const raw = await this.prisma.aiUsageRecord.create({
      data: {
        id: record.id,
        workflowId: record.workflowId,
        agentName: record.agentName,
        model: record.model,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        totalTokens: record.totalTokens,
        estimatedCostUsd: record.estimatedCostUsd,
        actualCostUsd: record.actualCostUsd,
        latencyMs: record.latencyMs,
        reevaluationCount: record.reevaluationCount,
        createdAt: new Date(record.createdAt)
      }
    });
    return this.mapUsage(raw);
  }

  async getUsageSince(since: Date): Promise<AiUsageRecordEntity[]> {
    const records = await this.prisma.aiUsageRecord.findMany({
      where: {
        createdAt: { gte: since }
      },
      orderBy: { createdAt: 'desc' }
    });
    return records.map((r) => this.mapUsage(r));
  }

  async getBudget(): Promise<TenantAiBudgetEntity | null> {
    const raw = await this.prisma.tenantAiBudget.findFirst();
    return raw ? this.mapBudget(raw) : null;
  }

  async setBudget(budget: TenantAiBudgetEntity): Promise<TenantAiBudgetEntity> {
    const existing = await this.prisma.tenantAiBudget.findFirst();
    let raw: PrismaTenantAiBudget;
    if (existing) {
      raw = await this.prisma.tenantAiBudget.update({
        where: { id: existing.id },
        data: {
          dailyBudgetUsd: budget.dailyBudgetUsd,
          monthlyBudgetUsd: budget.monthlyBudgetUsd,
          perTransactionBudgetUsd: budget.perTransactionBudgetUsd,
          perAgentDailyBudgetUsd: budget.perAgentDailyBudgetUsd,
          updatedAt: new Date()
        }
      });
    } else {
      raw = await this.prisma.tenantAiBudget.create({
        data: {
          id: budget.id,
          dailyBudgetUsd: budget.dailyBudgetUsd,
          monthlyBudgetUsd: budget.monthlyBudgetUsd,
          perTransactionBudgetUsd: budget.perTransactionBudgetUsd,
          perAgentDailyBudgetUsd: budget.perAgentDailyBudgetUsd,
          createdAt: new Date(budget.createdAt),
          updatedAt: new Date(budget.updatedAt)
        }
      });
    }
    return this.mapBudget(raw);
  }
}
