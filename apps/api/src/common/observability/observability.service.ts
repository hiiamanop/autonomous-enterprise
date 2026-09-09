import { Inject, Injectable } from '@nestjs/common';
import { TenantContextStorage } from '@autonomous-enterprise/shared';
import { AuditService } from '../audit/audit.service';
import { AgentRegistryService } from '../../modules/agent-registry/agent-registry.service';
import { AiBudgetService } from '../../modules/ai-budget/ai-budget.service';
import {
  INFRASTRUCTURE_REPOSITORY,
  type IInfrastructureRepository
} from '../../modules/infrastructure/domain/infrastructure.repository.interface';
import type { ObservabilitySnapshot } from './observability.types';

@Injectable()
export class ObservabilityService {
  constructor(
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(AgentRegistryService) private readonly agentRegistryService: AgentRegistryService,
    @Inject(AiBudgetService) private readonly aiBudgetService: AiBudgetService,
    @Inject(INFRASTRUCTURE_REPOSITORY)
    private readonly infrastructureRepository: IInfrastructureRepository
  ) {}

  private getTenantId(): string {
    return TenantContextStorage.getTenantId() || 'enterprise';
  }

  async getSnapshot(): Promise<ObservabilitySnapshot> {
    const tenantId = this.getTenantId();

    const logs = this.auditService.getLogs(tenantId);
    const actionsByType: Record<string, number> = {};
    let failureCount = 0;
    let successCount = 0;
    for (const log of logs) {
      actionsByType[log.action] = (actionsByType[log.action] ?? 0) + 1;
      if (log.status === 'FAILURE' || log.status === 'REJECTED') {
        failureCount += 1;
      } else {
        successCount += 1;
      }
    }

    const agentsResponse = await this.agentRegistryService.listAgents();
    const agents = agentsResponse.data ?? [];
    const trustScores = agents
      .map((agent) => agent.trustProfile?.overallTrust)
      .filter((score): score is number => typeof score === 'number');
    const averageTrustScore =
      trustScores.length > 0 ? trustScores.reduce((sum, s) => sum + s, 0) / trustScores.length : 0;

    const budgetExceededCount = logs.filter(
      (log) => log.action === 'AI_INTERACTION_BUDGET_EXCEEDED'
    ).length;
    const circuitBreakerTriggeredCount = logs.filter(
      (log) => log.action === 'CIRCUIT_BREAKER_TRIGGERED'
    ).length;
    const escalationCount = logs.filter(
      (log) => log.action === 'CONFLICT_ESCALATED' || log.action === 'INFRA_SCALING_ESCALATED'
    ).length;
    const totalAiCalls = logs.filter((log) => log.action === 'ORCHESTRATOR_MODEL_ROUTED').length;
    const totalTokensUsed = await this.aiBudgetService.getDailyTokenUsage();

    const scalingEvents = await this.infrastructureRepository.findAllScalingEvents();

    return {
      enterpriseId: tenantId,
      business: {
        totalAuditEvents: logs.length,
        actionsByType,
        failureCount,
        successCount
      },
      ai: {
        agentCount: agents.length,
        averageTrustScore,
        totalAiCalls,
        totalTokensUsed,
        budgetExceededCount,
        circuitBreakerTriggeredCount,
        escalationCount
      },
      infrastructure: {
        totalScalingEvents: scalingEvents.length,
        executedScalingEvents: scalingEvents.filter((e) => e.status === 'EXECUTED').length,
        rejectedScalingEvents: scalingEvents.filter((e) => e.status === 'POLICY_REJECTED').length,
        escalatedScalingEvents: scalingEvents.filter((e) => e.status === 'ESCALATED').length,
        failedScalingEvents: scalingEvents.filter((e) => e.status === 'FAILED').length
      },
      capturedAt: new Date().toISOString()
    };
  }
}
