import type { LeaveType } from '@autonomous-enterprise/contracts';

export class RequestLeaveDto {
  employeeId!: string;
  type!: LeaveType;
  startDate!: string;
  endDate!: string;
  reason?: string;
}
