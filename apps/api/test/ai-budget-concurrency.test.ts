import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AiBudgetService } from '../src/modules/ai-budget/ai-budget.service';
import { AI_BUDGET_REPOSITORY } from '../src/modules/ai-budget/domain/ai-budget.repository.interface';
import { InMemoryAiBudgetRepository } from '../src/modules/ai-budget/infrastructure/in-memory-ai-budget.repository';
import { RedisService } from '../src/common/messaging/redis.service';
import { TenantContextStorage } from '@autonomous-enterprise/shared';

describe('AiBudgetService concurrency safety', () => {
  const withTenant = <T>(tenantId: string, fn: () => Promise<T>): Promise<T> =>
    TenantContextStorage.run(
      { tenantId, actor: { id: 'sys', type: 'agent', tenantId, roles: [], permissions: [] } },
      fn
    );

  it('without a distributed lock, concurrent reserveAndRecordUsage calls can both pass the same stale budget check (documents the known limitation)', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AiBudgetService,
        { provide: AI_BUDGET_REPOSITORY, useClass: InMemoryAiBudgetRepository }
      ]
    }).compile();

    const service = moduleRef.get(AiBudgetService);

    await withTenant('tenant-race-nolock', async () => {
      await service.setBudget({ dailyBudgetUsd: 1, perTransactionBudgetUsd: 1 });

      const results = await Promise.all([
        service.reserveAndRecordUsage({
          model: 'test-model',
          inputTokens: 100,
          outputTokens: 100,
          estimatedCostUsd: 0.6,
          latencyMs: 10
        }),
        service.reserveAndRecordUsage({
          model: 'test-model',
          inputTokens: 100,
          outputTokens: 100,
          estimatedCostUsd: 0.6,
          latencyMs: 10
        })
      ]);

      const allowedCount = results.filter((r) => r.allowed).length;
      expect(allowedCount).toBeGreaterThanOrEqual(1);
    });
  });

  it('with a distributed lock available, concurrent reserveAndRecordUsage calls are serialized and the second respects the updated budget', async () => {
    let lockHeld = false;
    const redisServiceMock = {
      isEnabled: () => true,
      acquireLock: vi.fn(async (_key: string, _ttl: number) => {
        while (lockHeld) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        lockHeld = true;
        return 'lock-token';
      }),
      releaseLock: vi.fn(async () => {
        lockHeld = false;
      })
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AiBudgetService,
        { provide: AI_BUDGET_REPOSITORY, useClass: InMemoryAiBudgetRepository },
        { provide: RedisService, useValue: redisServiceMock }
      ]
    }).compile();

    const service = moduleRef.get(AiBudgetService);

    await withTenant('tenant-race-withlock', async () => {
      await service.setBudget({ dailyBudgetUsd: 1, perTransactionBudgetUsd: 1 });

      const results = await Promise.all([
        service.reserveAndRecordUsage({
          model: 'test-model',
          inputTokens: 100,
          outputTokens: 100,
          estimatedCostUsd: 0.6,
          latencyMs: 10
        }),
        service.reserveAndRecordUsage({
          model: 'test-model',
          inputTokens: 100,
          outputTokens: 100,
          estimatedCostUsd: 0.6,
          latencyMs: 10
        })
      ]);

      const allowedCount = results.filter((r) => r.allowed).length;
      expect(allowedCount).toBe(1);

      const status = await service.getStatus();
      expect(status.dailyUsedUsd).toBeCloseTo(0.6, 5);
    });
  });
});
