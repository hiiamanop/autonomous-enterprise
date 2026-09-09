export interface BusinessObservabilitySnapshot {
  totalAuditEvents: number;
  actionsByType: Record<string, number>;
  failureCount: number;
  successCount: number;
}

export interface AiObservabilitySnapshot {
  agentCount: number;
  averageTrustScore: number;
  totalAiCalls: number;
  totalTokensUsed: number;
  budgetExceededCount: number;
  circuitBreakerTriggeredCount: number;
  escalationCount: number;
}

export interface InfrastructureObservabilitySnapshot {
  totalScalingEvents: number;
  executedScalingEvents: number;
  rejectedScalingEvents: number;
  escalatedScalingEvents: number;
  failedScalingEvents: number;
}

export interface ObservabilitySnapshot {
  enterpriseId: string;
  business: BusinessObservabilitySnapshot;
  ai: AiObservabilitySnapshot;
  infrastructure: InfrastructureObservabilitySnapshot;
  capturedAt: string;
}
