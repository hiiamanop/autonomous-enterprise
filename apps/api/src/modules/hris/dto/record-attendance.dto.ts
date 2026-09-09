import type { AttendanceStatus } from '@autonomous-enterprise/contracts';

export class RecordAttendanceDto {
  employeeId!: string;
  date?: string;
  clockIn?: string;
  clockOut?: string;
  status?: AttendanceStatus;
}
