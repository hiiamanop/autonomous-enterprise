export class ProcessPurchaseApprovalDto {
  purchaseOrderId!: string;
  budgetId!: string;
  autoApprovalThreshold?: number;
  idempotencyKey?: string;
}
