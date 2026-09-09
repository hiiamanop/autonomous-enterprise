import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictResolutionService } from '../src/common/orchestration/conflict-resolution.service';
import { TicketingService } from '../src/modules/ticketing/ticketing.service';
import { TICKETING_REPOSITORY } from '../src/modules/ticketing/domain/ticketing.repository.interface';
import { InMemoryTicketingRepository } from '../src/modules/ticketing/infrastructure/in-memory-ticketing.repository';
import { AuditService } from '../src/common/audit/audit.service';
import { TenantContextStorage } from '@autonomous-enterprise/shared';

describe('ConflictResolutionService', () => {
  let service: ConflictResolutionService;
  let ticketingService: TicketingService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ConflictResolutionService,
        AuditService,
        TicketingService,
        { provide: TICKETING_REPOSITORY, useClass: InMemoryTicketingRepository }
      ]
    }).compile();

    service = moduleRef.get(ConflictResolutionService);
    ticketingService = moduleRef.get(TicketingService);
  });

  const withTenant = <T>(fn: () => Promise<T>): Promise<T> =>
    TenantContextStorage.run(
      {
        tenantId: 'tenant-conflict',
        actor: { id: 'sys', type: 'agent', tenantId: 'tenant-conflict', roles: [], permissions: [] }
      },
      fn
    );

  it('should report no conflict when both parties agree', async () => {
    await withTenant(async () => {
      const result = await service.detectAndResolve(
        { name: 'sales-agent', decision: 'STOCK_AVAILABLE', trustScore: 0.8 },
        { name: 'inventory-agent', decision: 'STOCK_AVAILABLE', trustScore: 0.9 },
        'wf-1'
      );

      expect(result.resolved).toBe(true);
      expect(result.escalated).toBe(false);
      expect(result.conflict.status).toBe('RESOLVED');
    });
  });

  it('should auto-resolve conflict via trust score when trust delta is sufficient', async () => {
    await withTenant(async () => {
      const result = await service.detectAndResolve(
        { name: 'finance-agent', decision: 'REJECT', trustScore: 0.95 },
        { name: 'infra-agent', decision: 'SCALE', trustScore: 0.5 },
        'wf-2'
      );

      expect(result.resolved).toBe(true);
      expect(result.escalated).toBe(false);
      expect(result.winningParty).toBe('finance-agent');
      expect(result.conflict.status).toBe('RESOLVED');
    });
  });

  it('should escalate to a ticket when trust delta is insufficient to auto-resolve', async () => {
    await withTenant(async () => {
      const result = await service.detectAndResolve(
        { name: 'hris-agent', decision: 'OVERTIME_REQUIRED', trustScore: 0.7 },
        { name: 'finance-agent', decision: 'OVERTIME_NOT_JUSTIFIED', trustScore: 0.72 },
        'wf-3'
      );

      expect(result.resolved).toBe(false);
      expect(result.escalated).toBe(true);
      expect(result.ticketId).toBeDefined();
      expect(result.conflict.status).toBe('ESCALATED');

      const ticketsResponse = await ticketingService.listTickets();
      expect(ticketsResponse.data?.length).toBe(1);
      expect(ticketsResponse.data?.[0].source).toBe('AgentConflictDetected');
    });
  });

  it('should escalate when both trust scores are below the minimum auto-resolve threshold', async () => {
    await withTenant(async () => {
      const result = await service.detectAndResolve(
        { name: 'agent-a', decision: 'A', trustScore: 0.4 },
        { name: 'agent-b', decision: 'B', trustScore: 0.55 },
        'wf-4'
      );

      expect(result.escalated).toBe(true);
    });
  });
});
