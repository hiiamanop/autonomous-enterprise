export class ExecuteGoalDto {
  goal!: string;
  agentName!: string;
  complexity!: 'SIMPLE_QUERY' | 'SIMPLE_CLASSIFICATION' | 'COMPLEX_REASONING' | 'CRITICAL_DECISION';
  riskLevel!: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  trustRequirement?: number;
  minConfidence?: number;
  maxIterations?: number;
  workflowId?: string;
  simulatedConfidence?: number;
}
