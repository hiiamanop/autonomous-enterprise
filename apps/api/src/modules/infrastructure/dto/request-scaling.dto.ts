export class RequestScalingDto {
  namespace!: string;
  deploymentName!: string;
  toReplicas!: number;
  reason!: string;
  projectedCostUsd!: number;
  budgetId?: string;
  confidence?: number;
  workflowId?: string;
}
