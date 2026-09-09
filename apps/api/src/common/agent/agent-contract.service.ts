import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { AgentMessage, ApiResponse } from '@autonomous-enterprise/contracts';
import { evaluatePolicy, validateAgentMessage, type PolicyRule } from '@autonomous-enterprise/shared';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AgentContractService {
  constructor(@Inject(AuditService) private readonly auditService: AuditService) {}

  processMessage(
    message: unknown,
    policies: PolicyRule[] = []
  ): ApiResponse<AgentMessage> {
    if (!validateAgentMessage(message)) {
      throw new BadRequestException('Invalid Agent Message structure per PRD section 30 contract');
    }

    const policyEval = evaluatePolicy(policies, {
      ...message.payload,
      confidence: message.metadata.confidence,
      priority: message.metadata.priority
    });

    if (!policyEval.allowed) {
      this.auditService.record({
        action: 'AGENT_POLICY_VIOLATION',
        workflowId: message.workflowId,
        agent: message.sender,
        input: message,
        status: 'REJECTED',
        reasoning: policyEval.reason,
        policyEvaluation: {
          allowed: false,
          ruleId: policyEval.ruleId,
          reason: policyEval.reason
        }
      });
      throw new BadRequestException(`Policy violation: ${policyEval.reason}`);
    }

    this.auditService.record({
      action: `AGENT_INTENT_${message.intent}`,
      workflowId: message.workflowId,
      agent: message.sender,
      input: message,
      status: 'SUCCESS',
      policyEvaluation: { allowed: true }
    });

    return {
      success: true,
      data: message,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }
}
