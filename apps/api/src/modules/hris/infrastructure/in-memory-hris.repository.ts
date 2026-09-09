import { Injectable } from '@nestjs/common';
import type {
  DepartmentEntity,
  EmployeeEntity,
  AttendanceEntity,
  LeaveEntity,
  OvertimeRequestEntity,
  IHrisRepository
} from '../domain/hris.repository.interface';

@Injectable()
export class InMemoryHrisRepository implements IHrisRepository {
  private readonly departments: Map<string, DepartmentEntity> = new Map();
  private readonly employees: Map<string, EmployeeEntity> = new Map();
  private readonly attendances: Map<string, AttendanceEntity> = new Map();
  private readonly leaves: Map<string, LeaveEntity> = new Map();
  private readonly overtimeRequests: Map<string, OvertimeRequestEntity> = new Map();

  async createDepartment(department: DepartmentEntity): Promise<DepartmentEntity> {
    this.departments.set(department.id, { ...department });
    return { ...department };
  }

  async findDepartmentById(id: string): Promise<DepartmentEntity | null> {
    const found = this.departments.get(id);
    return found ? { ...found } : null;
  }

  async findAllDepartments(): Promise<DepartmentEntity[]> {
    return Array.from(this.departments.values()).map((d) => ({ ...d }));
  }

  async createEmployee(employee: EmployeeEntity): Promise<EmployeeEntity> {
    this.employees.set(employee.id, { ...employee });
    return { ...employee };
  }

  async updateEmployee(employee: EmployeeEntity): Promise<EmployeeEntity> {
    if (!this.employees.has(employee.id)) {
      throw new Error(`Employee ${employee.id} not found`);
    }
    this.employees.set(employee.id, { ...employee });
    return { ...employee };
  }

  async findEmployeeById(id: string): Promise<EmployeeEntity | null> {
    const found = this.employees.get(id);
    return found ? { ...found } : null;
  }

  async findAllEmployees(departmentId?: string): Promise<EmployeeEntity[]> {
    return Array.from(this.employees.values())
      .filter((e) => {
        if (departmentId && e.departmentId !== departmentId) return false;
        return true;
      })
      .map((e) => ({ ...e }));
  }

  async createAttendance(attendance: AttendanceEntity): Promise<AttendanceEntity> {
    this.attendances.set(attendance.id, { ...attendance });
    return { ...attendance };
  }

  async updateAttendance(attendance: AttendanceEntity): Promise<AttendanceEntity> {
    if (!this.attendances.has(attendance.id)) {
      throw new Error(`Attendance ${attendance.id} not found`);
    }
    this.attendances.set(attendance.id, { ...attendance });
    return { ...attendance };
  }

  async findAttendanceById(id: string): Promise<AttendanceEntity | null> {
    const found = this.attendances.get(id);
    return found ? { ...found } : null;
  }

  async findAttendanceByEmployee(employeeId: string): Promise<AttendanceEntity[]> {
    return Array.from(this.attendances.values())
      .filter((a) => a.employeeId === employeeId)
      .map((a) => ({ ...a }));
  }

  async createLeave(leave: LeaveEntity): Promise<LeaveEntity> {
    this.leaves.set(leave.id, { ...leave });
    return { ...leave };
  }

  async updateLeave(leave: LeaveEntity): Promise<LeaveEntity> {
    if (!this.leaves.has(leave.id)) {
      throw new Error(`Leave ${leave.id} not found`);
    }
    this.leaves.set(leave.id, { ...leave });
    return { ...leave };
  }

  async findLeaveById(id: string): Promise<LeaveEntity | null> {
    const found = this.leaves.get(id);
    return found ? { ...found } : null;
  }

  async findLeavesByEmployee(employeeId: string): Promise<LeaveEntity[]> {
    return Array.from(this.leaves.values())
      .filter((l) => l.employeeId === employeeId)
      .map((l) => ({ ...l }));
  }

  async createOvertimeRequest(request: OvertimeRequestEntity): Promise<OvertimeRequestEntity> {
    this.overtimeRequests.set(request.id, { ...request });
    return { ...request };
  }

  async updateOvertimeRequest(request: OvertimeRequestEntity): Promise<OvertimeRequestEntity> {
    if (!this.overtimeRequests.has(request.id)) {
      throw new Error(`OvertimeRequest ${request.id} not found`);
    }
    this.overtimeRequests.set(request.id, { ...request });
    return { ...request };
  }

  async findOvertimeRequestById(id: string): Promise<OvertimeRequestEntity | null> {
    const found = this.overtimeRequests.get(id);
    return found ? { ...found } : null;
  }

  async findOvertimeRequestsByEmployee(employeeId: string): Promise<OvertimeRequestEntity[]> {
    return Array.from(this.overtimeRequests.values())
      .filter((o) => o.employeeId === employeeId)
      .map((o) => ({ ...o }));
  }

  async findOvertimeRequestsSince(sinceIso: string): Promise<OvertimeRequestEntity[]> {
    const sinceTime = new Date(sinceIso).getTime();
    return Array.from(this.overtimeRequests.values())
      .filter((o) => new Date(o.createdAt).getTime() >= sinceTime)
      .map((o) => ({ ...o }));
  }
}
