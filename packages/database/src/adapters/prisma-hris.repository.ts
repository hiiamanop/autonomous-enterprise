import type {
  PrismaClient,
  Department as PrismaDepartment,
  Employee as PrismaEmployee,
  EmployeeStatus as PrismaEmployeeStatus,
  Attendance as PrismaAttendance,
  AttendanceStatus as PrismaAttendanceStatus,
  Leave as PrismaLeave,
  LeaveType as PrismaLeaveType,
  LeaveStatus as PrismaLeaveStatus,
  OvertimeRequest as PrismaOvertimeRequest,
  OvertimeStatus as PrismaOvertimeStatus
} from '@prisma/client';

export type EmployeeStatusEnum = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'TERMINATED';
export type AttendanceStatusEnum = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | 'HALF_DAY';
export type LeaveTypeEnum = 'ANNUAL' | 'SICK' | 'MATERNITY' | 'PATERNITY' | 'UNPAID' | 'OTHER';
export type LeaveStatusEnum = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type OvertimeStatusEnum = 'REQUESTED' | 'APPROVED' | 'REJECTED';

export interface DepartmentEntity {
  id: string;
  name: string;
  code?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeEntity {
  id: string;
  departmentId: string;
  employeeCode?: string;
  fullName: string;
  email: string;
  position: string;
  status: EmployeeStatusEnum;
  hourlyRate?: number;
  hireDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceEntity {
  id: string;
  employeeId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  clockIn?: string;
  clockOut?: string;
  status: AttendanceStatusEnum;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveEntity {
  id: string;
  employeeId: string;
  type: LeaveTypeEnum;
  startDate: string;
  endDate: string;
  reason?: string;
  status: LeaveStatusEnum;
  createdAt: string;
  updatedAt: string;
}

export interface OvertimeRequestEntity {
  id: string;
  employeeId: string;
  date: string;
  hours: number;
  reason?: string;
  estimatedCost: number;
  status: OvertimeStatusEnum;
  createdAt: string;
  updatedAt: string;
}

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

export class PrismaHrisRepository implements IHrisRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapDepartment(raw: PrismaDepartment): DepartmentEntity {
    return {
      id: raw.id,
      name: raw.name,
      code: raw.code,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapEmployee(raw: PrismaEmployee): EmployeeEntity {
    return {
      id: raw.id,
      departmentId: raw.departmentId,
      employeeCode: raw.employeeCode,
      fullName: raw.fullName,
      email: raw.email,
      position: raw.position,
      status: raw.status as EmployeeStatusEnum,
      hireDate: raw.hireDate.toISOString(),
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapAttendance(raw: PrismaAttendance): AttendanceEntity {
    return {
      id: raw.id,
      employeeId: raw.employeeId,
      date: raw.date.toISOString(),
      checkIn: raw.checkIn ? raw.checkIn.toISOString() : undefined,
      checkOut: raw.checkOut ? raw.checkOut.toISOString() : undefined,
      clockIn: raw.checkIn ? raw.checkIn.toISOString() : undefined,
      clockOut: raw.checkOut ? raw.checkOut.toISOString() : undefined,
      status: raw.status as AttendanceStatusEnum,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapLeave(raw: PrismaLeave): LeaveEntity {
    return {
      id: raw.id,
      employeeId: raw.employeeId,
      type: raw.type as LeaveTypeEnum,
      startDate: raw.startDate.toISOString(),
      endDate: raw.endDate.toISOString(),
      reason: raw.reason ?? undefined,
      status: raw.status as LeaveStatusEnum,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapOvertime(raw: PrismaOvertimeRequest): OvertimeRequestEntity {
    return {
      id: raw.id,
      employeeId: raw.employeeId,
      date: raw.date.toISOString(),
      hours: raw.hours,
      reason: raw.reason ?? undefined,
      estimatedCost: raw.estimatedCost,
      status: raw.status as OvertimeStatusEnum,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  async createDepartment(department: DepartmentEntity): Promise<DepartmentEntity> {
    const created = await this.prisma.department.create({
      data: {
        id: department.id,
        name: department.name,
        code: department.code || department.name.toUpperCase().replace(/\s+/g, '_'),
        createdAt: department.createdAt ? new Date(department.createdAt) : undefined,
        updatedAt: department.updatedAt ? new Date(department.updatedAt) : undefined
      }
    });
    return this.mapDepartment(created);
  }

  async findDepartmentById(id: string): Promise<DepartmentEntity | null> {
    const found = await this.prisma.department.findUnique({
      where: { id }
    });
    return found ? this.mapDepartment(found) : null;
  }

  async findAllDepartments(): Promise<DepartmentEntity[]> {
    const list = await this.prisma.department.findMany({
      orderBy: { name: 'asc' }
    });
    return list.map((d) => this.mapDepartment(d));
  }

  async createEmployee(employee: EmployeeEntity): Promise<EmployeeEntity> {
    const created = await this.prisma.employee.create({
      data: {
        id: employee.id,
        departmentId: employee.departmentId,
        employeeCode: employee.employeeCode || `EMP-${Date.now()}`,
        fullName: employee.fullName,
        email: employee.email,
        position: employee.position,
        status: (employee.status || 'ACTIVE') as PrismaEmployeeStatus,
        hireDate: employee.hireDate ? new Date(employee.hireDate) : new Date(),
        createdAt: employee.createdAt ? new Date(employee.createdAt) : undefined,
        updatedAt: employee.updatedAt ? new Date(employee.updatedAt) : undefined
      }
    });
    return this.mapEmployee(created);
  }

  async updateEmployee(employee: EmployeeEntity): Promise<EmployeeEntity> {
    const updated = await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        departmentId: employee.departmentId,
        fullName: employee.fullName,
        email: employee.email,
        position: employee.position,
        status: employee.status as PrismaEmployeeStatus,
        updatedAt: new Date()
      }
    });
    return this.mapEmployee(updated);
  }

  async findEmployeeById(id: string): Promise<EmployeeEntity | null> {
    const found = await this.prisma.employee.findUnique({
      where: { id }
    });
    return found ? this.mapEmployee(found) : null;
  }

  async findAllEmployees(departmentId?: string): Promise<EmployeeEntity[]> {
    const list = await this.prisma.employee.findMany({
      where: {
        departmentId: departmentId || undefined
      },
      orderBy: { createdAt: 'desc' }
    });
    return list.map((e) => this.mapEmployee(e));
  }

  async createAttendance(attendance: AttendanceEntity): Promise<AttendanceEntity> {
    const created = await this.prisma.attendance.create({
      data: {
        id: attendance.id,
        employeeId: attendance.employeeId,
        date: new Date(attendance.date),
        checkIn: attendance.checkIn || attendance.clockIn ? new Date(attendance.checkIn || attendance.clockIn!) : undefined,
        checkOut: attendance.checkOut || attendance.clockOut ? new Date(attendance.checkOut || attendance.clockOut!) : undefined,
        status: (attendance.status === 'HALF_DAY' ? 'PRESENT' : attendance.status) as PrismaAttendanceStatus,
        createdAt: attendance.createdAt ? new Date(attendance.createdAt) : undefined,
        updatedAt: attendance.updatedAt ? new Date(attendance.updatedAt) : undefined
      }
    });
    return this.mapAttendance(created);
  }

  async updateAttendance(attendance: AttendanceEntity): Promise<AttendanceEntity> {
    const updated = await this.prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkIn: attendance.checkIn || attendance.clockIn ? new Date(attendance.checkIn || attendance.clockIn!) : undefined,
        checkOut: attendance.checkOut || attendance.clockOut ? new Date(attendance.checkOut || attendance.clockOut!) : undefined,
        status: (attendance.status === 'HALF_DAY' ? 'PRESENT' : attendance.status) as PrismaAttendanceStatus,
        updatedAt: new Date()
      }
    });
    return this.mapAttendance(updated);
  }

  async findAttendanceById(id: string): Promise<AttendanceEntity | null> {
    const found = await this.prisma.attendance.findUnique({
      where: { id }
    });
    return found ? this.mapAttendance(found) : null;
  }

  async findAttendanceByEmployee(employeeId: string): Promise<AttendanceEntity[]> {
    const list = await this.prisma.attendance.findMany({
      where: { employeeId },
      orderBy: { date: 'desc' }
    });
    return list.map((a) => this.mapAttendance(a));
  }

  async createLeave(leave: LeaveEntity): Promise<LeaveEntity> {
    const created = await this.prisma.leave.create({
      data: {
        id: leave.id,
        employeeId: leave.employeeId,
        type: (leave.type === 'OTHER' ? 'UNPAID' : leave.type) as PrismaLeaveType,
        startDate: new Date(leave.startDate),
        endDate: new Date(leave.endDate),
        reason: leave.reason,
        status: leave.status as PrismaLeaveStatus,
        createdAt: leave.createdAt ? new Date(leave.createdAt) : undefined,
        updatedAt: leave.updatedAt ? new Date(leave.updatedAt) : undefined
      }
    });
    return this.mapLeave(created);
  }

  async updateLeave(leave: LeaveEntity): Promise<LeaveEntity> {
    const updated = await this.prisma.leave.update({
      where: { id: leave.id },
      data: {
        status: leave.status as PrismaLeaveStatus,
        updatedAt: new Date()
      }
    });
    return this.mapLeave(updated);
  }

  async findLeaveById(id: string): Promise<LeaveEntity | null> {
    const found = await this.prisma.leave.findUnique({
      where: { id }
    });
    return found ? this.mapLeave(found) : null;
  }

  async findLeavesByEmployee(employeeId: string): Promise<LeaveEntity[]> {
    const list = await this.prisma.leave.findMany({
      where: { employeeId },
      orderBy: { startDate: 'desc' }
    });
    return list.map((l) => this.mapLeave(l));
  }

  async createOvertimeRequest(request: OvertimeRequestEntity): Promise<OvertimeRequestEntity> {
    const created = await this.prisma.overtimeRequest.create({
      data: {
        id: request.id,
        employeeId: request.employeeId,
        date: new Date(request.date),
        hours: request.hours,
        reason: request.reason,
        estimatedCost: request.estimatedCost || 0,
        status: request.status as PrismaOvertimeStatus,
        createdAt: request.createdAt ? new Date(request.createdAt) : undefined,
        updatedAt: request.updatedAt ? new Date(request.updatedAt) : undefined
      }
    });
    return this.mapOvertime(created);
  }

  async updateOvertimeRequest(request: OvertimeRequestEntity): Promise<OvertimeRequestEntity> {
    const updated = await this.prisma.overtimeRequest.update({
      where: { id: request.id },
      data: {
        status: request.status as PrismaOvertimeStatus,
        updatedAt: new Date()
      }
    });
    return this.mapOvertime(updated);
  }

  async findOvertimeRequestById(id: string): Promise<OvertimeRequestEntity | null> {
    const found = await this.prisma.overtimeRequest.findUnique({
      where: { id }
    });
    return found ? this.mapOvertime(found) : null;
  }

  async findOvertimeRequestsByEmployee(employeeId: string): Promise<OvertimeRequestEntity[]> {
    const list = await this.prisma.overtimeRequest.findMany({
      where: { employeeId },
      orderBy: { date: 'desc' }
    });
    return list.map((o) => this.mapOvertime(o));
  }

  async findOvertimeRequestsSince(sinceIso: string): Promise<OvertimeRequestEntity[]> {
    const list = await this.prisma.overtimeRequest.findMany({
      where: {
        createdAt: {
          gte: new Date(sinceIso)
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return list.map((o) => this.mapOvertime(o));
  }
}
