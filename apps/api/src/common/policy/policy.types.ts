export interface PolicyContext {
  amount: number;
  supplierVerified: boolean;
  budgetAvailable: boolean;
  autoApprovalThreshold: number;
}

export interface FinancialPostingPolicyContext {
  amount: number;
  isBalanced: boolean;
  autoApprovalThreshold: number;
}

export interface InfrastructureScalingPolicyContext {
  isScaleUp: boolean;
  projectedCostUsd: number;
  budgetAvailable: boolean;
  confidence: number;
  minConfidenceThreshold: number;
  maxReplicas: number;
  requestedReplicas: number;
}

export type PolicyDecision = 'AUTO_APPROVE' | 'REQUIRE_HUMAN_APPROVAL' | 'REJECT';

export interface PolicyEvaluationResult {
  decision: PolicyDecision;
  reasons: string[];
  evaluatedAt: string;
}
