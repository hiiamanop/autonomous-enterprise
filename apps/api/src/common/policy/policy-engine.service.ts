import { Injectable } from '@nestjs/common';
import type {
  FinancialPostingPolicyContext,
  InfrastructureScalingPolicyContext,
  PolicyContext,
  PolicyEvaluationResult
} from './policy.types';

@Injectable()
export class PolicyEngineService {
  evaluateFinancialPostingPolicy(context: FinancialPostingPolicyContext): PolicyEvaluationResult {
    const reasons: string[] = [];

    if (!context.isBalanced) {
      reasons.push('Journal entries are not balanced: total debit must equal total credit');
      return {
        decision: 'REJECT',
        reasons,
        evaluatedAt: new Date().toISOString()
      };
    }

    if (context.amount > context.autoApprovalThreshold) {
      reasons.push(
        `Posting amount [${context.amount}] exceeds auto-approval threshold [${context.autoApprovalThreshold}]`
      );
      return {
        decision: 'REQUIRE_HUMAN_APPROVAL',
        reasons,
        evaluatedAt: new Date().toISOString()
      };
    }

    reasons.push('Journal balanced and amount within auto-approval threshold');
    return {
      decision: 'AUTO_APPROVE',
      reasons,
      evaluatedAt: new Date().toISOString()
    };
  }

  evaluateProcurementPolicy(context: PolicyContext): PolicyEvaluationResult {
    const reasons: string[] = [];

    if (!context.supplierVerified) {
      reasons.push('Supplier is not verified');
      return {
        decision: 'REJECT',
        reasons,
        evaluatedAt: new Date().toISOString()
      };
    }

    if (!context.budgetAvailable) {
      reasons.push('Budget is not available for the requested amount');
      return {
        decision: 'REJECT',
        reasons,
        evaluatedAt: new Date().toISOString()
      };
    }

    if (context.amount > context.autoApprovalThreshold) {
      reasons.push(
        `Amount [${context.amount}] exceeds auto-approval threshold [${context.autoApprovalThreshold}]`
      );
      return {
        decision: 'REQUIRE_HUMAN_APPROVAL',
        reasons,
        evaluatedAt: new Date().toISOString()
      };
    }

    reasons.push('Supplier verified, budget available, amount within auto-approval threshold');
    return {
      decision: 'AUTO_APPROVE',
      reasons,
      evaluatedAt: new Date().toISOString()
    };
  }

  evaluateInfrastructureScalingPolicy(
    context: InfrastructureScalingPolicyContext
  ): PolicyEvaluationResult {
    const reasons: string[] = [];

    if (context.requestedReplicas > context.maxReplicas) {
      reasons.push(
        `Requested replicas [${context.requestedReplicas}] exceeds tenant maximum [${context.maxReplicas}]`
      );
      return {
        decision: 'REJECT',
        reasons,
        evaluatedAt: new Date().toISOString()
      };
    }

    if (context.isScaleUp && !context.budgetAvailable) {
      reasons.push(`Projected cost [${context.projectedCostUsd}] exceeds available infrastructure budget`);
      return {
        decision: 'REJECT',
        reasons,
        evaluatedAt: new Date().toISOString()
      };
    }

    if (context.confidence < context.minConfidenceThreshold) {
      reasons.push(
        `Confidence [${context.confidence}] below minimum threshold [${context.minConfidenceThreshold}] required for autonomous scaling`
      );
      return {
        decision: 'REQUIRE_HUMAN_APPROVAL',
        reasons,
        evaluatedAt: new Date().toISOString()
      };
    }

    reasons.push('Budget available, replica limit respected, confidence above threshold');
    return {
      decision: 'AUTO_APPROVE',
      reasons,
      evaluatedAt: new Date().toISOString()
    };
  }
}
