import type { EmployeeStatus } from '@autonomous-enterprise/contracts';

export class CreateEmployeeDto {
  departmentId!: string;
  fullName!: string;
  email!: string;
  position!: string;
  status?: EmployeeStatus;
  hourlyRate!: number;
}
