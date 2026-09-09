export class CreateExpenseDto {
  amount!: number;
  description!: string;
  requestedBy!: string;
  budgetId?: string;
  costCenterId?: string;
}
