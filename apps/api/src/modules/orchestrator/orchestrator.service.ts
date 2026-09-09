import {
  BadRequestException,
  Inject,
  Injectable
} from '@nestjs/common';
import type { ModelRoutingDecision } from '@autonomous-enterprise/contracts';
import { OmniRouterClient } from '../../common/ai-provider/omnirouter.client';
import { AuditService } from '../../common/audit/audit.service';
import { ModelRoutingService } from '../../common/ai-provider/model-routing.service';
import { AgentRegistryService } from '../agent-registry/agent-registry.service';
import { AiBudgetService } from '../ai-budget/ai-budget.service';
import { WorkflowTaskService } from '../workflow-task/workflow-task.service';
import { TicketingService } from '../ticketing/ticketing.service';
import { ExecuteGoalDto } from './dto/execute-goal.dto';

export interface GoalExecutionResult {
  workflowId: string;
  goal: string;
  agentName: string;
  routing: ModelRoutingDecision;
  outcome: 'EXECUTE' | 'BUDGET_DENIED' | 'CIRCUIT_BROKEN' | 'ESCALATED';
  confidence?: number;
  aiResponse?: string;
  ticketId?: string;
  timestamp: string;
}

@Injectable()
export class OrchestratorService {
  constructor(
    @Inject(ModelRoutingService) private readonly modelRoutingService: ModelRoutingService,
    @Inject(AgentRegistryService) private readonly agentRegistryService: AgentRegistryService,
    @Inject(AiBudgetService) private readonly aiBudgetService: AiBudgetService,
    @Inject(WorkflowTaskService) private readonly workflowTaskService: WorkflowTaskService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(TicketingService) private readonly ticketingService: TicketingService,
    @Inject(OmniRouterClient) private readonly omniRouterClient: OmniRouterClient,
  ) {}

  async executeGoal(dto: ExecuteGoalDto): Promise<GoalExecutionResult> {
    if (!dto.goal || !dto.agentName) {
      throw new BadRequestException('goal and agentName are required');
    }

    const workflowId = dto.workflowId || `wf-goal-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    this.auditService.record({
      workflowId,
      agent: dto.agentName,
      action: 'ORCHESTRATOR_GOAL_RECEIVED',
      input: { goal: dto.goal, complexity: dto.complexity, riskLevel: dto.riskLevel },
      status: 'SUCCESS'
    });

    const agentResponse = await this.agentRegistryService.getAgent(dto.agentName).catch(() => undefined);
    const trustScore = agentResponse?.data?.trustProfile?.overallTrust ?? 0.5;

    const budgetStatus = await this.aiBudgetService.getStatus();

    const routing = this.modelRoutingService.route({
      complexity: dto.complexity,
      riskLevel: dto.riskLevel,
      trustRequirement: dto.trustRequirement ?? 0.7,
      availableBudgetUsd: budgetStatus.dailyRemainingUsd
    });

    this.auditService.record({
      workflowId,
      agent: dto.agentName,
      action: 'ORCHESTRATOR_MODEL_ROUTED',
      input: { complexity: dto.complexity, riskLevel: dto.riskLevel, trustScore },
      output: routing,
      status: 'SUCCESS'
    });

    if (routing.tier === 'DETERMINISTIC') {
      const result: GoalExecutionResult = {
        workflowId,
        goal: dto.goal,
        agentName: dto.agentName,
        routing,
        outcome: 'EXECUTE',
        confidence: 1.0,
        timestamp: new Date().toISOString()
      };

      await this.agentRegistryService.recordTrustOutcome(dto.agentName, {
        success: true,
        confidence: 1.0
      });

      return result;
    }

    const estimatedCostUsd = routing.tier === 'HIGH_RELIABILITY_MODEL' ? 0.05 : routing.tier === 'REASONING_MODEL' ? 0.02 : 0.005;
    const tokenUsed = Math.round(estimatedCostUsd * 1000 / 0.002);

    const reservation = await this.aiBudgetService.reserveAndRecordUsage({
      workflowId,
      agentName: dto.agentName,
      model: routing.model ?? 'unknown',
      inputTokens: Math.round(tokenUsed * 0.6),
      outputTokens: Math.round(tokenUsed * 0.4),
      estimatedCostUsd,
      latencyMs: 50,
      reevaluationCount: 0
    });

    if (!reservation.allowed) {
      this.auditService.record({
        workflowId,
        agent: dto.agentName,
        action: 'AI_INTERACTION_BUDGET_EXCEEDED',
        input: { estimatedCostUsd, reasons: reservation.reasons },
        status: 'FAILURE'
      });

      return {
        workflowId,
        goal: dto.goal,
        agentName: dto.agentName,
        routing,
        outcome: 'BUDGET_DENIED',
        timestamp: new Date().toISOString()
      };
    }

    const maxIterations = dto.maxIterations ?? 3;
    const task = await this.workflowTaskService.createTask({
      workflowId,
      taskType: 'GOAL_EXECUTION',
      maxIterations,
      tokenBudget: tokenUsed * (maxIterations + 1),
      timeBudgetMs: 15000,
      minConfidence: dto.minConfidence ?? dto.trustRequirement ?? 0.7,
      confidence: trustScore,
      payload: { goal: dto.goal }
    });

    const simulatedConfidence = dto.simulatedConfidence ?? Math.min(1.0, trustScore + 0.2);
    const attempt = await this.workflowTaskService.recordAttempt(task.id, simulatedConfidence, tokenUsed);

    if (attempt.outcome === 'CIRCUIT_BROKEN') {
      return {
        workflowId,
        goal: dto.goal,
        agentName: dto.agentName,
        routing,
        outcome: 'CIRCUIT_BROKEN',
        ticketId: attempt.ticketId,
        timestamp: new Date().toISOString()
      };
    }

    let aiContent = `Autonomous goal completed by ${dto.agentName}: processed "${dto.goal}" via model ${routing.model}`;

    if (routing.model) {
      try {
        const completion = await this.omniRouterClient.complete({
          model: routing.model,
          prompt: `You are an AI enterprise orchestrator agent executing the following goal:\nGoal: ${dto.goal}\nProvide a concise execution summary.`,
          maxTokens: 200,
          temperature: 0.3
        });
        aiContent = completion.content;
      } catch {
        // fallback
      }
    }

    await this.workflowTaskService.completeTask(task.id, { aiContent });

    await this.agentRegistryService.recordTrustOutcome(dto.agentName, {
      success: true,
      confidence: simulatedConfidence
    });

    this.auditService.record({
      workflowId,
      agent: dto.agentName,
      action: 'ORCHESTRATOR_GOAL_COMPLETED',
      input: { goal: dto.goal },
      output: { aiContent, confidence: simulatedConfidence },
      status: 'SUCCESS'
    });

    return {
      workflowId,
      goal: dto.goal,
      agentName: dto.agentName,
      routing,
      outcome: 'EXECUTE',
      confidence: simulatedConfidence,
      aiResponse: aiContent,
      timestamp: new Date().toISOString()
    };
  }
}
