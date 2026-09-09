export class CreateSalesRepDto {
  fullName!: string;
  email!: string;
  territory?: string;
  quotaMonthlyUsd?: number;
  employeeId?: string;
}

export class AssignLeadDto {
  repId!: string;
}

export class CloseLeadDto {
  outcome!: 'WON' | 'LOST';
  lostReason?: string;
}
