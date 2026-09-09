import type { EmployeeStatus } from '@autonomous-enterprise/contracts';

export class UpdateEmployeeDto {
  departmentId?: string;
  fullName?: string;
  email?: string;
  position?: string;
  status?: EmployeeStatus;
  hourlyRate?: number;
}
