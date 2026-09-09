export class CreateBudgetDto {
  name!: string;
  totalAmount!: number;
  period!: string;
  costCenterId?: string;
}
