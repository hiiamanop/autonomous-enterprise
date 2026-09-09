export class ProcessFinancialPostingDto {
  journalId!: string;
  autoApprovalThreshold?: number;
  confidence?: number;
  idempotencyKey?: string;
}
