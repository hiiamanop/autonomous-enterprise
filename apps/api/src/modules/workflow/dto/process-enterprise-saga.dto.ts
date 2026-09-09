export class ProcessEnterpriseSagaDto {
  salesOrderId!: string;
  warehouseId!: string;
  supplierId!: string;
  budgetId!: string;
  employeeId!: string;
  departmentId?: string;
  deploymentName = 'sample-api-workload';
  namespace = 'autonomous-enterprise';
  targetReplicas = 3;
  scalingCostUsd = 5;
  autoScale = true;
}
