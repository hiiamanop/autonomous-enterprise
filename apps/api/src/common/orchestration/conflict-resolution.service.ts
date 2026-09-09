import { Inject, Injectable } from '@nestjs/common';
import { TenantContextStorage } from '@autonomous-enterprise/shared';
import { AuditService } from '../audit/audit.service';
import { TicketingService } from '../../modules/ticketing/ticketing.service';
import type { ConflictLog, ConflictParty, ConflictResolutionResult } from './conflict.types';

const TRUST_RESOLUTION_MARGIN = 0.15;
const MIN_TRUST_TO_AUTO_RESOLVE = 0.6;

@Injectable()
export class ConflictResolutionService {
  constructor(
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(TicketingService) private readonly ticketingService: TicketingService
  ) {}

  async detectAndResolve(
    partyA: ConflictParty,
    partyB: ConflictParty,
    workflowId?: string
  ): Promise<ConflictResolutionResult> {
    const tenantId = TenantContextStorage.getTenantId() ?? 'unknown';
    const now = new Date().toISOString();

    if (partyA.decision === partyB.decision) {
      const conflict: ConflictLog = {
        id: `conflict-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        workflowId,
        partyA,
        partyB,
        status: 'RESOLVED',
        resolution: `No conflict: both parties agree on [${partyA.decision}]`,
        createdAt: now,
        resolvedAt: now
      };
      return { conflict, resolved: true, winningParty: undefined, escalated: false };
    }

    this.auditService.record({
      workflowId,
      action: 'CONFLICT_DETECTED',
      input: { partyA, partyB },
      status: 'SUCCESS'
    });

    const trustA = partyA.trustScore ?? 0.5;
    const trustB = partyB.trustScore ?? 0.5;
    const trustDelta = Math.abs(trustA - trustB);

    const canAutoResolve =
      trustDelta >= TRUST_RESOLUTION_MARGIN &&
      Math.max(trustA, trustB) >= MIN_TRUST_TO_AUTO_RESOLVE;

    if (canAutoResolve) {
      const winner = trustA > trustB ? partyA : partyB;
      const conflict: ConflictLog = {
        id: `conflict-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        workflowId,
        partyA,
        partyB,
        status: 'RESOLVED',
        resolution: `Resolved via trust score: [${winner.name}] decision [${winner.decision}] selected (trust ${winner.trustScore})`,
        createdAt: now,
        resolvedAt: new Date().toISOString()
      };

      this.auditService.record({
        workflowId,
        action: 'CONFLICT_RESOLVED',
        input: { partyA, partyB },
        output: conflict,
        status: 'SUCCESS'
      });

      return { conflict, resolved: true, winningParty: winner.name, escalated: false };
    }

    const ticket = await this.ticketingService.createSystemTicket(
      `Agent conflict requires human review: [${partyA.name}] vs [${partyB.name}]`,
      `${partyA.name} decided [${partyA.decision}] (trust ${trustA}); ${partyB.name} decided [${partyB.decision}] (trust ${trustB}). Trust delta insufficient for automatic resolution.`,
      'AgentConflictDetected',
      'HIGH',
      workflowId
    );

    const conflict: ConflictLog = {
      id: `conflict-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      workflowId,
      partyA,
      partyB,
      status: 'ESCALATED',
      resolution: `Escalated to ticket [${ticket.id}]: trust delta insufficient for automatic resolution`,
      createdAt: now,
      resolvedAt: new Date().toISOString()
    };

    this.auditService.record({
      workflowId,
      action: 'CONFLICT_ESCALATED',
      input: { partyA, partyB },
      output: { ticketId: ticket.id },
      status: 'SUCCESS'
    });

    return { conflict, resolved: false, escalated: true, ticketId: ticket.id };
  }
}
