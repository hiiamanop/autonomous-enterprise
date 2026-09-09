import type {
  Department,
  Employee,
  Attendance,
  Leave,
  OvertimeRequest,
  EmployeeStatus,
  AttendanceStatus,
  LeaveType,
  LeaveStatus,
  OvertimeStatus
} from '@autonomous-enterprise/contracts';

export type DepartmentEntity = Department;
export type EmployeeEntity = Employee;
export type AttendanceEntity = Attendance;
export type LeaveEntity = Leave;
export type OvertimeRequestEntity = OvertimeRequest;
export type EmployeeStatusEnum = EmployeeStatus | 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
export type AttendanceStatusEnum = AttendanceStatus | 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';
export type LeaveTypeEnum = LeaveType | 'ANNUAL' | 'SICK' | 'UNPAID' | 'OTHER';
export type LeaveStatusEnum = LeaveStatus | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type OvertimeStatusEnum = OvertimeStatus | 'REQUESTED' | 'APPROVED' | 'REJECTED';

export interface IHrisRepository {
  createDepartment(department: DepartmentEntity): Promise<DepartmentEntity>;
  findDepartmentById(id: string): Promise<DepartmentEntity | null>;
  findAllDepartments(): Promise<DepartmentEntity[]>;

  createEmployee(employee: EmployeeEntity): Promise<EmployeeEntity>;
  updateEmployee(employee: EmployeeEntity): Promise<EmployeeEntity>;
  findEmployeeById(id: string): Promise<EmployeeEntity | null>;
  findAllEmployees(departmentId?: string): Promise<EmployeeEntity[]>;

  createAttendance(attendance: AttendanceEntity): Promise<AttendanceEntity>;
  updateAttendance(attendance: AttendanceEntity): Promise<AttendanceEntity>;
  findAttendanceById(id: string): Promise<AttendanceEntity | null>;
  findAttendanceByEmployee(employeeId: string): Promise<AttendanceEntity[]>;

  createLeave(leave: LeaveEntity): Promise<LeaveEntity>;
  updateLeave(leave: LeaveEntity): Promise<LeaveEntity>;
  findLeaveById(id: string): Promise<LeaveEntity | null>;
  findLeavesByEmployee(employeeId: string): Promise<LeaveEntity[]>;

  createOvertimeRequest(request: OvertimeRequestEntity): Promise<OvertimeRequestEntity>;
  updateOvertimeRequest(request: OvertimeRequestEntity): Promise<OvertimeRequestEntity>;
  findOvertimeRequestById(id: string): Promise<OvertimeRequestEntity | null>;
  findOvertimeRequestsByEmployee(employeeId: string): Promise<OvertimeRequestEntity[]>;
  findOvertimeRequestsSince(sinceIso: string): Promise<OvertimeRequestEntity[]>;
}

export const HRIS_REPOSITORY = 'HRIS_REPOSITORY';
