import { Inject, Injectable, Optional } from '@nestjs/common';
import type { AuditRecord } from '@autonomous-enterprise/contracts';
import { RequestContextStorage, TenantContextStorage } from '@autonomous-enterprise/shared';
import { EventStreamService } from '../events/event-stream.service';

@Injectable()
export class AuditService {
  private readonly auditLogs: AuditRecord[] = [];

  /**
   * Optional so the audit trail keeps working when the event stream is not
   * wired up, which is the case in most unit tests. Broadcasting is a
   * side-channel for observers; it must never be able to fail a recorded
   * action.
   */
  constructor(@Optional() @Inject(EventStreamService) private readonly eventStream?: EventStreamService) {}

  /**
   * Records an audited action.
   *
   * Some actions are audited twice: once by AuditInterceptor from the HTTP
   * decorator, and once inside the service, which also captures calls made
   * agent-to-agent without an HTTP request. `skipIfAlreadyRecorded` lets the
   * interceptor stand down when the service has already written a richer record
   * for the same request, so the live trace shows one event per action rather
   * than a duplicate pair.
   */
  record(
    entry: Omit<AuditRecord, 'auditId' | 'timestamp' | 'actor'> & {
      actor?: AuditRecord['actor'];
    },
    options: { skipIfAlreadyRecorded?: boolean } = {}
  ): AuditRecord | null {
    if (options.skipIfAlreadyRecorded && this.recordedInCurrentRequest(entry.action)) {
      return null;
    }

    const context = RequestContextStorage.getContext() || TenantContextStorage.getContext();
    const currentActor = RequestContextStorage.getActor() || TenantContextStorage.getActor();

    const actor = entry.actor || currentActor || {
      id: 'system',
      type: 'user',
      roles: ['SUPER_ADMIN'],
      permissions: ['*']
    };

    const record: AuditRecord = {
      auditId: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      actor,
      agent: entry.agent || (actor.type === 'agent' ? actor.id : undefined),
      workflowId: entry.workflowId,
      action: entry.action,
      input: entry.input,
      output: entry.output,
      status: entry.status,
      reasoning: entry.reasoning,
      policyEvaluation: entry.policyEvaluation,
      // requestId is stamped on every record so duplicate audits within one
      // request can be detected without changing any caller.
      metadata: context?.requestId
        ? { ...(entry.metadata ?? {}), requestId: context.requestId }
        : entry.metadata
    };

    this.auditLogs.push(record);

    // Every audited action is broadcast so operators can watch the platform
    // react in real time. Previously only the simulator emitted events, so an
    // action triggered from the UI or the API left the live trace empty even
    // though it was fully recorded here.
    try {
      this.eventStream?.emitAuditEvent({
        action: record.action,
        tenantId: 'enterprise',
        actor: record.actor,
        timestamp: record.timestamp,
        metadata: {
          status: record.status,
          workflowId: record.workflowId,
          agent: record.agent,
          reasoning: record.reasoning,
          data: record.output ?? record.input
        }
      });
    } catch {
      // A broadcast failure must not lose the audit record.
    }

    return record;
  }

  /**
   * True when the given action was already recorded for the request currently
   * in scope. Correlation is by requestId, so two genuinely separate requests
   * performing the same action are never collapsed into one.
   */
  private recordedInCurrentRequest(action: string): boolean {
    const context = RequestContextStorage.getContext() || TenantContextStorage.getContext();
    const requestId = context?.requestId;
    if (!requestId) return false;

    return this.auditLogs.some(
      (log) => log.action === action && log.metadata?.requestId === requestId
    );
  }

  getLogs(_tenantId?: string): AuditRecord[] {
    return [...this.auditLogs];
  }

  getLogsByActor(actorId: string): AuditRecord[] {
    return this.auditLogs.filter((log) => log.actor.id === actorId);
  }

  getLogsByWorkflow(workflowId: string): AuditRecord[] {
    return this.auditLogs.filter((log) => log.workflowId === workflowId);
  }

  clearLogs(): void {
    this.auditLogs.length = 0;
  }
}
