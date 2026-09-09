import type { ChartOfAccountType } from '@autonomous-enterprise/contracts';

export class CreateChartOfAccountDto {
  code!: string;
  name!: string;
  type!: ChartOfAccountType;
}
