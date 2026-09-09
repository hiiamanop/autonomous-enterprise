import { BadRequestException, Inject, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { RequestContextStorage, TenantContextStorage } from '@autonomous-enterprise/shared';
import type { AiBudgetStatus, AiUsageRecord, TenantAiBudget } from './domain/ai-budget.types';
import {
  AI_BUDGET_REPOSITORY,
  type IAiBudgetRepository
} from './domain/ai-budget.repository.interface';
import { RedisService } from '../../common/messaging/redis.service';

export interface RecordUsageInput {
  workflowId?: string;
  agentName?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  actualCostUsd?: number;
  latencyMs: number;
  reevaluationCount?: number;
}

export interface BudgetCheckResult {
  allowed: boolean;
  status: AiBudgetStatus;
  reasons: string[];
}

const DEFAULT_BUDGET: Omit<TenantAiBudget, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'> = {
  dailyBudgetUsd: 10,
  monthlyBudgetUsd: 100,
  perTransactionBudgetUsd: 1,
  perAgentDailyBudgetUsd: 5
};

const LOCK_TTL_MS = 5000;

@Injectable()
export class AiBudgetService {
  constructor(
    @Inject(AI_BUDGET_REPOSITORY) private readonly repository: IAiBudgetRepository,
    @Optional() @Inject(RedisService) private readonly redisService?: RedisService
  ) {}

  private async withTenantBudgetLock<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    if (!this.redisService || !this.redisService.isEnabled()) {
      return fn();
    }
    const lockKey = `ai-budget-lock:${tenantId}`;
    const token = await this.redisService.acquireLock(lockKey, LOCK_TTL_MS);
    if (!token) {
      throw new BadRequestException('AI budget is being updated concurrently, please retry');
    }
    try {
      return await fn();
    } finally {
      await this.redisService.releaseLock(lockKey, token);
    }
  }

  private getTenantId(): string {
    return TenantContextStorage.getTenantId() || 'enterprise';
  }

  private startOfDay(): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private startOfMonth(): Date {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  async getOrCreateBudget(): Promise<TenantAiBudget> {
    const tenantId = this.getTenantId();
    const existing = await this.repository.findBudget(tenantId);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const budget: TenantAiBudget = {
      id: `budget-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenantId,
      ...DEFAULT_BUDGET,
      createdAt: now,
      updatedAt: now
    };
    return this.repository.upsertBudget(budget);
  }

  async setBudget(overrides: Partial<Omit<TenantAiBudget, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>): Promise<TenantAiBudget> {
    const tenantId = this.getTenantId();
    const current = await this.getOrCreateBudget();
    const updated: TenantAiBudget = {
      ...current,
      ...overrides,
      tenantId,
      updatedAt: new Date().toISOString()
    };
    return this.repository.upsertBudget(updated);
  }

  async getStatus(): Promise<AiBudgetStatus> {
    const tenantId = this.getTenantId();
    const budget = await this.getOrCreateBudget();

    const dailyUsage = await this.repository.findUsageSince(tenantId, this.startOfDay());
    const monthlyUsage = await this.repository.findUsageSince(tenantId, this.startOfMonth());

    const dailyUsedUsd = dailyUsage.reduce((sum, r) => sum + (r.actualCostUsd ?? r.estimatedCostUsd), 0);
    const monthlyUsedUsd = monthlyUsage.reduce((sum, r) => sum + (r.actualCostUsd ?? r.estimatedCostUsd), 0);

    return {
      tenantId,
      dailyUsedUsd,
      dailyRemainingUsd: Math.max(0, budget.dailyBudgetUsd - dailyUsedUsd),
      monthlyUsedUsd,
      monthlyRemainingUsd: Math.max(0, budget.monthlyBudgetUsd - monthlyUsedUsd),
      isDailyExceeded: dailyUsedUsd >= budget.dailyBudgetUsd,
      isMonthlyExceeded: monthlyUsedUsd >= budget.monthlyBudgetUsd
    };
  }

  async getDailyTokenUsage(): Promise<number> {
    const tenantId = this.getTenantId();
    const dailyUsage = await this.repository.findUsageSince(tenantId, this.startOfDay());
    return dailyUsage.reduce((sum, r) => sum + r.totalTokens, 0);
  }

  async getAgentUsageBreakdown(): Promise<
    Array<{
      agentName: string;
      model: string;
      dailySpent: number;
      dailyLimit: number;
      tokens: number;
      calls: number;
      avgLatencyMs: number;
    }>
  > {
    const tenantId = this.getTenantId();
    const budget = await this.getOrCreateBudget();
    const dailyUsage = await this.repository.findUsageSince(tenantId, this.startOfDay());

    const grouped = new Map<
      string,
      { model: string; dailySpent: number; tokens: number; calls: number; latencySum: number }
    >();

    for (const record of dailyUsage) {
      const key = record.agentName || 'unknown-agent';
      const existing = grouped.get(key) || {
        model: record.model || 'unknown',
        dailySpent: 0,
        tokens: 0,
        calls: 0,
        latencySum: 0
      };

      existing.model = record.model || existing.model;
      existing.dailySpent += record.actualCostUsd ?? record.estimatedCostUsd;
      existing.tokens += record.totalTokens;
      existing.calls += 1;
      existing.latencySum += record.latencyMs ?? 0;
      grouped.set(key, existing);
    }

    return Array.from(grouped.entries())
      .map(([agentName, value]) => ({
        agentName,
        model: value.model,
        dailySpent: value.dailySpent,
        dailyLimit: budget.perAgentDailyBudgetUsd,
        tokens: value.tokens,
        calls: value.calls,
        avgLatencyMs: value.calls > 0 ? Math.round(value.latencySum / value.calls) : 0
      }))
      .sort((a, b) => b.dailySpent - a.dailySpent);
  }

  private async evaluateBudgetAvailability(
    tenantId: string,
    estimatedCostUsd: number,
    agentName?: string
  ): Promise<BudgetCheckResult> {
    const budget = await this.getOrCreateBudget();
    const status = await this.getStatus();
    const reasons: string[] = [];

    if (estimatedCostUsd > budget.perTransactionBudgetUsd) {
      reasons.push(
        `Estimated cost [$${estimatedCostUsd.toFixed(4)}] exceeds per-transaction budget [$${budget.perTransactionBudgetUsd}]`
      );
    }

    if (status.isDailyExceeded || status.dailyRemainingUsd < estimatedCostUsd) {
      reasons.push(
        `Daily AI budget exceeded or insufficient: remaining [$${status.dailyRemainingUsd.toFixed(4)}], requested [$${estimatedCostUsd.toFixed(4)}]`
      );
    }

    if (status.isMonthlyExceeded || status.monthlyRemainingUsd < estimatedCostUsd) {
      reasons.push(
        `Monthly AI budget exceeded or insufficient: remaining [$${status.monthlyRemainingUsd.toFixed(4)}], requested [$${estimatedCostUsd.toFixed(4)}]`
      );
    }

    if (agentName) {
      const agentUsage = await this.repository.findUsageSince(tenantId, this.startOfDay(), agentName);
      const agentUsedUsd = agentUsage.reduce((sum, r) => sum + (r.actualCostUsd ?? r.estimatedCostUsd), 0);
      if (agentUsedUsd + estimatedCostUsd > budget.perAgentDailyBudgetUsd) {
        reasons.push(
          `Agent [${agentName}] daily budget exceeded: used [$${agentUsedUsd.toFixed(4)}], per-agent limit [$${budget.perAgentDailyBudgetUsd}]`
        );
      }
    }

    return { allowed: reasons.length === 0, status, reasons };
  }

  async checkBudgetAvailability(estimatedCostUsd: number, agentName?: string): Promise<BudgetCheckResult> {
    const tenantId = this.getTenantId();
    return this.evaluateBudgetAvailability(tenantId, estimatedCostUsd, agentName);
  }

  async recordUsage(input: RecordUsageInput): Promise<AiUsageRecord> {
    const tenantId = this.getTenantId();

    if (input.inputTokens < 0 || input.outputTokens < 0) {
      throw new BadRequestException('Token counts cannot be negative');
    }

    const record: AiUsageRecord = {
      id: `ai-usage-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenantId,
      workflowId: input.workflowId,
      agentName: input.agentName,
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      totalTokens: input.inputTokens + input.outputTokens,
      estimatedCostUsd: input.estimatedCostUsd,
      actualCostUsd: input.actualCostUsd,
      latencyMs: input.latencyMs,
      reevaluationCount: input.reevaluationCount ?? 0,
      createdAt: new Date().toISOString()
    };

    return this.repository.createUsageRecord(record);
  }

  async reserveAndRecordUsage(
    input: RecordUsageInput
  ): Promise<{ allowed: boolean; reasons: string[]; record?: AiUsageRecord }> {
    const tenantId = this.getTenantId();

    if (input.inputTokens < 0 || input.outputTokens < 0) {
      throw new BadRequestException('Token counts cannot be negative');
    }

    return this.withTenantBudgetLock(tenantId, async () => {
      const check = await this.evaluateBudgetAvailability(
        tenantId,
        input.estimatedCostUsd,
        input.agentName
      );
      if (!check.allowed) {
        return { allowed: false, reasons: check.reasons };
      }

      const record: AiUsageRecord = {
        id: `ai-usage-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        tenantId,
        workflowId: input.workflowId,
        agentName: input.agentName,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        totalTokens: input.inputTokens + input.outputTokens,
        estimatedCostUsd: input.estimatedCostUsd,
        actualCostUsd: input.actualCostUsd,
        latencyMs: input.latencyMs,
        reevaluationCount: input.reevaluationCount ?? 0,
        createdAt: new Date().toISOString()
      };

      const created = await this.repository.createUsageRecord(record);
      return { allowed: true, reasons: [], record: created };
    });
  }
}
