import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowTaskService } from '../src/modules/workflow-task/workflow-task.service';
import { WORKFLOW_TASK_REPOSITORY } from '../src/modules/workflow-task/domain/workflow-task.repository.interface';
import { InMemoryWorkflowTaskRepository } from '../src/modules/workflow-task/infrastructure/in-memory-workflow-task.repository';
import { TicketingService } from '../src/modules/ticketing/ticketing.service';
import { TICKETING_REPOSITORY } from '../src/modules/ticketing/domain/ticketing.repository.interface';
import { InMemoryTicketingRepository } from '../src/modules/ticketing/infrastructure/in-memory-ticketing.repository';
import { AuditService } from '../src/common/audit/audit.service';
import { TenantContextStorage } from '@autonomous-enterprise/shared';

describe('WorkflowTaskService Bounded Re-Evaluation', () => {
  let service: WorkflowTaskService;
  let ticketingService: TicketingService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowTaskService,
        AuditService,
        TicketingService,
        { provide: WORKFLOW_TASK_REPOSITORY, useClass: InMemoryWorkflowTaskRepository },
        { provide: TICKETING_REPOSITORY, useClass: InMemoryTicketingRepository }
      ]
    }).compile();

    service = moduleRef.get(WorkflowTaskService);
    ticketingService = moduleRef.get(TicketingService);
  });

  const withTenant = <T>(fn: () => Promise<T>): Promise<T> =>
    TenantContextStorage.run(
      {
        tenantId: 'tenant-reeval',
        actor: { id: 'sys', type: 'agent', tenantId: 'tenant-reeval', roles: [], permissions: [] }
      },
      fn
    );

  it('should execute immediately when confidence meets minimum on first attempt', async () => {
    await withTenant(async () => {
      const task = await service.createTask('wf-1', 'TEST_TASK', { minConfidence: 0.8 });
      const outcome = await service.recordAttempt(task.id, 0.95, 100);

      expect(outcome.outcome).toBe('EXECUTE');
      expect(outcome.task.status).toBe('COMPLETED');
      expect(outcome.task.iterationCount).toBe(1);
    });
  });

  it('should retry when confidence is below minimum but within iteration budget', async () => {
    await withTenant(async () => {
      const task = await service.createTask('wf-2', 'TEST_TASK', {
        minConfidence: 0.9,
        maxIterations: 3
      });
      const outcome = await service.recordAttempt(task.id, 0.5, 100);

      expect(outcome.outcome).toBe('RETRY');
      expect(outcome.task.status).toBe('IN_PROGRESS');
      expect(outcome.task.iterationCount).toBe(1);
    });
  });

  it('should trigger circuit breaker and create a ticket when max iterations exceeded', async () => {
    await withTenant(async () => {
      const task = await service.createTask('wf-3', 'TEST_TASK', {
        minConfidence: 0.99,
        maxIterations: 2
      });

      await service.recordAttempt(task.id, 0.3, 100);
      await service.recordAttempt(task.id, 0.4, 100);
      const finalOutcome = await service.recordAttempt(task.id, 0.5, 100);

      expect(finalOutcome.outcome).toBe('CIRCUIT_BROKEN');
      expect(finalOutcome.task.status).toBe('ESCALATED');
      expect(finalOutcome.ticketId).toBeDefined();

      const ticketsResponse = await ticketingService.listTickets();
      expect(ticketsResponse.data?.length).toBe(1);
      expect(ticketsResponse.data?.[0].source).toBe('CircuitBreaker');
    });
  });

  it('should trigger circuit breaker when token budget is exceeded', async () => {
    await withTenant(async () => {
      const task = await service.createTask('wf-4', 'TEST_TASK', {
        minConfidence: 0.99,
        maxIterations: 10,
        tokenBudget: 150
      });

      const outcome = await service.recordAttempt(task.id, 0.3, 200);

      expect(outcome.outcome).toBe('CIRCUIT_BROKEN');
      expect(outcome.task.status).toBe('ESCALATED');
    });
  });

  it('should persist task state across attempts (iteration count and token usage accumulate)', async () => {
    await withTenant(async () => {
      const task = await service.createTask('wf-5', 'TEST_TASK', {
        minConfidence: 0.99,
        maxIterations: 5,
        tokenBudget: 5000
      });

      await service.recordAttempt(task.id, 0.3, 100);
      await service.recordAttempt(task.id, 0.4, 150);
      const reloaded = await service.getTask(task.id);

      expect(reloaded.iterationCount).toBe(2);
      expect(reloaded.tokenUsed).toBe(250);
    });
  });
});
