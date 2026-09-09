import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  ApiResponse,
  Department,
  Employee,
  Attendance,
  Leave,
  OvertimeRequest,
  WorkloadSummary,
  Delivery,
  StaffingAssessment
} from '@autonomous-enterprise/contracts';
import {
  EmployeeStatus,
  AttendanceStatus,
  LeaveStatus,
  OvertimeStatus,
  StaffRole,
  DeliveryStatus
} from '@autonomous-enterprise/contracts';
import { RequestContextStorage, TenantContextStorage } from '@autonomous-enterprise/shared';
import { AuditService } from '../../common/audit/audit.service';
import { OutboxService } from '../workflow/outbox.service';
import { TicketingService } from '../ticketing/ticketing.service';
import { HRIS_REPOSITORY, type IHrisRepository } from './domain/hris.repository.interface';
import { DELIVERY_REPOSITORY, type IDeliveryRepository } from './domain/delivery.repository.interface';
import type { CreateDepartmentDto } from './dto/create-department.dto';
import type { CreateEmployeeDto } from './dto/create-employee.dto';
import type { UpdateEmployeeDto } from './dto/update-employee.dto';
import type { RecordAttendanceDto } from './dto/record-attendance.dto';
import type { RequestLeaveDto } from './dto/request-leave.dto';
import type { RequestOvertimeDto } from './dto/request-overtime.dto';

@Injectable()
export class HrisService {
  private readonly logger = new Logger(HrisService.name);

  constructor(
    @Inject(HRIS_REPOSITORY)
    private readonly repository: IHrisRepository,
    @Optional()
    @Inject(AuditService)
    private readonly auditService?: AuditService,
    @Optional()
    @Inject(OutboxService)
    private readonly outboxService?: OutboxService,
    @Optional()
    @Inject(TicketingService)
    private readonly ticketingService?: TicketingService,
    @Optional()
    @Inject(DELIVERY_REPOSITORY)
    private readonly deliveryRepository?: IDeliveryRepository
  ) {}

  private buildMetadata() {
    const context = RequestContextStorage.getContext() || TenantContextStorage.getContext();
    return {
      timestamp: new Date().toISOString(),
      requestId: context?.requestId
    };
  }

  private classifyRole(position: string): StaffRole {
    const p = (position || '').toUpperCase();
    if (p.includes('WAREHOUSE') || p.includes('PICKER') || p.includes('PACKER') || p.includes('GUDANG')) {
      return StaffRole.WAREHOUSE;
    }
    if (p.includes('COURIER') || p.includes('DRIVER') || p.includes('KURIR') || p.includes('DELIVERY')) {
      return StaffRole.COURIER;
    }
    return StaffRole.OTHER;
  }

  async assessStaffing(input: {
    departmentId: string;
    pendingOrders: number;
    ordersReadyToShip?: Array<{ orderId: string; orderNumber: string }>;
  }): Promise<ApiResponse<StaffingAssessment>> {
    const now = new Date().toISOString();
    const employeesRes = await this.listEmployees(input.departmentId);
    const employees = employeesRes.data ?? [];

    const warehouseStaff = employees.filter((e) => this.classifyRole(e.position) === StaffRole.WAREHOUSE);
    const courierStaff = employees.filter((e) => this.classifyRole(e.position) === StaffRole.COURIER);

    const warehouseCap = warehouseStaff.length * 4;
    const courierCap = courierStaff.length * 5;

    let activeDeliveriesCount = 0;
    const courierLoads: Array<{ courier: Employee; load: number }> = [];

    if (this.deliveryRepository) {
      for (const courier of courierStaff) {
        const active = await this.deliveryRepository.findActiveByCourier(courier.id);
        courierLoads.push({ courier, load: active.length });
        activeDeliveriesCount += active.length;
      }
    } else {
      courierStaff.forEach((c) => courierLoads.push({ courier: c, load: 0 }));
    }

    const warehouseUtilization = warehouseCap > 0 ? Number((input.pendingOrders / warehouseCap).toFixed(2)) : 0;
    const courierUtilization = courierCap > 0 ? Number((activeDeliveriesCount / courierCap).toFixed(2)) : 0;

    const peakUtil = Math.max(warehouseUtilization, courierUtilization);
    const severity: StaffingAssessment['severity'] =
      peakUtil >= 2 ? 'CRITICAL' : peakUtil > 1 ? 'OVERLOADED' : peakUtil >= 0.75 ? 'BUSY' : 'NORMAL';

    const deliveryIds: string[] = [];
    const overtimeRequestIds: string[] = [];
    const actionsTaken: string[] = [];
    let escalationTicketId: string | undefined;
    let hiringRecommendation: string | undefined;

    if (this.deliveryRepository && input.ordersReadyToShip?.length) {
      for (const order of input.ordersReadyToShip) {
        const existing = await this.deliveryRepository.findByOrderId(order.orderId);
        if (existing) continue;

        courierLoads.sort((a, b) => a.load - b.load);
        const target = courierLoads[0];
        if (!target) break;

        const delivery: Delivery = {
          id: `dlv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          courierId: target.courier.id,
          courierName: target.courier.fullName,
          status: DeliveryStatus.ASSIGNED,
          assignedAt: now,
          createdAt: now,
          updatedAt: now
        };

        await this.deliveryRepository.create(delivery);
        deliveryIds.push(delivery.id);
        target.load += 1;
        actionsTaken.push(`Assigned ${order.orderNumber} to courier ${target.courier.fullName}`);
      }
    }

    if (severity === 'OVERLOADED' || severity === 'CRITICAL') {
      const overloadedGroup = warehouseUtilization >= courierUtilization ? warehouseStaff : courierStaff;
      const groupLabel = warehouseUtilization >= courierUtilization ? 'warehouse' : 'courier';
      const excessRatio = Math.max(warehouseUtilization, courierUtilization) - 1;
      const overtimeHours = Math.max(1, Math.min(4, Math.ceil(excessRatio * 4)));

      for (const staff of overloadedGroup) {
        try {
          const created = await this.requestOvertime({
            employeeId: staff.id,
            date: now.slice(0, 10),
            hours: overtimeHours,
            reason: `Fulfillment surge: ${input.pendingOrders} pending orders, ${groupLabel} utilization ${(Math.max(warehouseUtilization, courierUtilization) * 100).toFixed(0)}%`
          });
          if (created.data?.id) {
            overtimeRequestIds.push(created.data.id);
          }
        } catch {
          continue;
        }
      }

      if (overtimeRequestIds.length > 0) {
        actionsTaken.push(
          `Requested ${overtimeHours}h overtime for ${overtimeRequestIds.length} ${groupLabel} staff`
        );
      }
    }

    if (severity === 'CRITICAL') {
      const neededWarehouse = Math.max(0, Math.ceil(input.pendingOrders / 4) - warehouseStaff.length);
      const neededCouriers = Math.max(0, Math.ceil(activeDeliveriesCount / 5) - courierStaff.length);
      const recs: string[] = [];
      if (neededWarehouse > 0) recs.push(`hire ${neededWarehouse} additional warehouse staff`);
      if (neededCouriers > 0) recs.push(`hire ${neededCouriers} additional couriers`);
      hiringRecommendation = recs.length > 0 ? recs.join(' and ') : 'hire additional fulfillment staff';

      if (this.ticketingService) {
        try {
          const ticket = await this.ticketingService.createSystemTicket(
            `CRITICAL Staffing Shortage in Fulfillment (${(peakUtil * 100).toFixed(0)}% util)`,
            [
              `Warehouse utilization: ${(warehouseUtilization * 100).toFixed(0)}% (${input.pendingOrders} orders / ${warehouseCap} cap)`,
              `Courier utilization: ${(courierUtilization * 100).toFixed(0)}% (${activeDeliveriesCount} active / ${courierCap} cap)`,
              `Overtime requests created: ${overtimeRequestIds.length}`,
              `Recommendation: ${hiringRecommendation}`,
              `Automated escalation from HRIS Agent assessment.`
            ].join('\n'),
            'hris-staffing-agent',
            'CRITICAL' as any
          );
          escalationTicketId = ticket.id;
          actionsTaken.push(`Created CRITICAL escalation ticket ${ticket.id}`);
        } catch (err: any) {
          // Escalation is best-effort so a ticketing outage cannot fail the
          // assessment, but the failure must be visible: silently swallowing it
          // previously hid a broken call signature that stopped every critical
          // staffing shortage from ever reaching a human.
          this.logger.warn(`Failed to create staffing escalation ticket: ${err?.message}`);
          actionsTaken.push(`Escalation ticket creation FAILED: ${err?.message ?? 'unknown error'}`);
        }
      }
    }

    const assessment: StaffingAssessment = {
      departmentId: input.departmentId,
      assessedAt: now,
      warehouseStaff: warehouseStaff.length,
      courierStaff: courierStaff.length,
      warehouseCapacity: warehouseCap,
      courierCapacity: courierCap,
      pendingOrders: input.pendingOrders,
      activeDeliveries: activeDeliveriesCount,
      unassignedOrders: Math.max(0, input.pendingOrders - deliveryIds.length),
      warehouseUtilization,
      courierUtilization,
      severity,
      deliveryIds,
      overtimeRequestIds,
      escalationTicketId,
      hiringRecommendation,
      actionsTaken
    };

    if (this.auditService) {
      this.auditService.record({
        action: 'STAFFING_ASSESSED',
        status: 'SUCCESS',
        input: { departmentId: input.departmentId, pendingOrders: input.pendingOrders },
        output: {
          severity,
          warehouseUtilization,
          courierUtilization,
          deliveriesAssigned: deliveryIds.length,
          overtimeRequests: overtimeRequestIds.length,
          escalationTicketId
        },
        reasoning: actionsTaken.join('; ') || 'Staffing levels nominal'
      });
    }

    return { success: true, data: assessment, metadata: this.buildMetadata() };
  }

  async listDeliveries(): Promise<ApiResponse<Delivery[]>> {
    if (!this.deliveryRepository) {
      return { success: true, data: [], metadata: this.buildMetadata() };
    }
    const deliveries = await this.deliveryRepository.findAll();
    return { success: true, data: deliveries, metadata: this.buildMetadata() };
  }

  async createDepartment(dto: CreateDepartmentDto): Promise<ApiResponse<Department>> {
    if (!dto.name || dto.name.trim() === '') {
      throw new BadRequestException('Department name is required');
    }

    const department: Department = {
      id: randomUUID(),
      name: dto.name.trim(),
      code: dto.name.trim().toUpperCase().replace(/\s+/g, '_'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const created = await this.repository.createDepartment(department);

    if (this.auditService) {
      this.auditService.record({
        action: 'CREATE_DEPARTMENT',
        status: 'SUCCESS',
        input: dto,
        output: created
      });
    }

    return {
      success: true,
      data: created,
      metadata: this.buildMetadata()
    };
  }

  async listDepartments(): Promise<ApiResponse<Department[]>> {
    const departments = await this.repository.findAllDepartments();
    return {
      success: true,
      data: departments,
      metadata: this.buildMetadata()
    };
  }

  async getDepartment(id: string): Promise<ApiResponse<Department>> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Department ID is required');
    }

    const department = await this.repository.findDepartmentById(id);
    if (!department) {
      throw new NotFoundException(`Department with id ${id} not found`);
    }

    return {
      success: true,
      data: department,
      metadata: this.buildMetadata()
    };
  }

  async createEmployee(dto: CreateEmployeeDto): Promise<ApiResponse<Employee>> {
    if (
      !dto.departmentId ||
      !dto.fullName ||
      !dto.email ||
      !dto.position ||
      dto.hourlyRate === undefined ||
      dto.hourlyRate === null
    ) {
      throw new BadRequestException('Department ID, full name, email, position, and hourly rate are required');
    }

    if (dto.hourlyRate < 0) {
      throw new BadRequestException('Hourly rate cannot be negative');
    }

    const department = await this.repository.findDepartmentById(dto.departmentId);
    if (!department) {
      throw new NotFoundException(`Department with id ${dto.departmentId} not found`);
    }

    const employee: Employee = {
      id: randomUUID(),
      departmentId: dto.departmentId,
      employeeCode: `EMP-${Date.now()}`,
      fullName: dto.fullName.trim(),
      email: dto.email.trim(),
      position: dto.position.trim(),
      status: EmployeeStatus.ACTIVE,
      hourlyRate: dto.hourlyRate,
      hireDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const created = await this.repository.createEmployee(employee);

    if (this.auditService) {
      this.auditService.record({
        action: 'CREATE_EMPLOYEE',
        status: 'SUCCESS',
        input: dto,
        output: created
      });
    }

    return {
      success: true,
      data: created,
      metadata: this.buildMetadata()
    };
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto): Promise<ApiResponse<Employee>> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Employee ID is required');
    }

    const existing = await this.repository.findEmployeeById(id);
    if (!existing) {
      throw new NotFoundException(`Employee with id ${id} not found`);
    }

    if (dto.departmentId) {
      const department = await this.repository.findDepartmentById(dto.departmentId);
      if (!department) {
        throw new NotFoundException(`Department with id ${dto.departmentId} not found`);
      }
      existing.departmentId = dto.departmentId;
    }

    if (dto.fullName) existing.fullName = dto.fullName.trim();
    if (dto.email) existing.email = dto.email.trim();
    if (dto.position) existing.position = dto.position.trim();
    if (dto.status) existing.status = dto.status;
    if (dto.hourlyRate !== undefined) existing.hourlyRate = dto.hourlyRate;

    existing.updatedAt = new Date().toISOString();

    const updated = await this.repository.updateEmployee(existing);

    if (this.auditService) {
      this.auditService.record({
        action: 'UPDATE_EMPLOYEE',
        status: 'SUCCESS',
        input: { id, ...dto },
        output: updated
      });
    }

    return {
      success: true,
      data: updated,
      metadata: this.buildMetadata()
    };
  }

  async listEmployees(departmentId?: string): Promise<ApiResponse<Employee[]>> {
    const employees = await this.repository.findAllEmployees(departmentId);
    return {
      success: true,
      data: employees,
      metadata: this.buildMetadata()
    };
  }

  async getEmployee(id: string): Promise<ApiResponse<Employee>> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Employee ID is required');
    }

    const employee = await this.repository.findEmployeeById(id);
    if (!employee) {
      throw new NotFoundException(`Employee with id ${id} not found`);
    }

    return {
      success: true,
      data: employee,
      metadata: this.buildMetadata()
    };
  }

  async recordAttendance(dto: RecordAttendanceDto): Promise<ApiResponse<Attendance>> {
    if (!dto.employeeId || !dto.date) {
      throw new BadRequestException('Employee ID and date are required');
    }

    const employee = await this.repository.findEmployeeById(dto.employeeId);
    if (!employee) {
      throw new NotFoundException(`Employee with id ${dto.employeeId} not found`);
    }

    const attendance: Attendance = {
      id: randomUUID(),
      employeeId: dto.employeeId,
      date: dto.date,
      clockIn: dto.clockIn || new Date().toISOString(),
      clockOut: dto.clockOut,
      status: dto.status || AttendanceStatus.PRESENT,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const created = await this.repository.createAttendance(attendance);

    if (this.auditService) {
      this.auditService.record({
        action: 'RECORD_ATTENDANCE',
        status: 'SUCCESS',
        input: dto,
        output: created
      });
    }

    return {
      success: true,
      data: created,
      metadata: this.buildMetadata()
    };
  }

  async clockOut(id: string): Promise<ApiResponse<Attendance>> {
    const attendance = await this.repository.findAttendanceById(id);
    if (!attendance) {
      throw new NotFoundException(`Attendance record with id ${id} not found`);
    }
    attendance.clockOut = new Date().toISOString();
    attendance.updatedAt = new Date().toISOString();
    const updated = await this.repository.updateAttendance(attendance);
    return { success: true, data: updated, metadata: this.buildMetadata() };
  }

  async listAttendanceByEmployee(employeeId: string): Promise<ApiResponse<Attendance[]>> {
    if (!employeeId || employeeId.trim() === '') {
      throw new BadRequestException('Employee ID is required');
    }

    const employee = await this.repository.findEmployeeById(employeeId);
    if (!employee) {
      throw new NotFoundException(`Employee with id ${employeeId} not found`);
    }

    const attendances = await this.repository.findAttendanceByEmployee(employeeId);
    return {
      success: true,
      data: attendances,
      metadata: this.buildMetadata()
    };
  }

  async requestLeave(dto: RequestLeaveDto): Promise<ApiResponse<Leave>> {
    if (!dto.employeeId || !dto.type || !dto.startDate || !dto.endDate) {
      throw new BadRequestException('Employee ID, type, start date, and end date are required');
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) {
      throw new BadRequestException('End date must be after or equal to start date');
    }

    const employee = await this.repository.findEmployeeById(dto.employeeId);
    if (!employee) {
      throw new NotFoundException(`Employee with id ${dto.employeeId} not found`);
    }

    const leave: Leave = {
      id: randomUUID(),
      employeeId: dto.employeeId,
      type: dto.type,
      startDate: dto.startDate,
      endDate: dto.endDate,
      reason: dto.reason,
      status: LeaveStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const created = await this.repository.createLeave(leave);

    if (this.auditService) {
      this.auditService.record({
        action: 'REQUEST_LEAVE',
        status: 'SUCCESS',
        input: dto,
        output: created
      });
    }

    return {
      success: true,
      data: created,
      metadata: this.buildMetadata()
    };
  }

  async approveLeave(leaveId: string): Promise<ApiResponse<Leave>> {
    if (!leaveId || leaveId.trim() === '') {
      throw new BadRequestException('Leave ID is required');
    }

    const leave = await this.repository.findLeaveById(leaveId);
    if (!leave) {
      throw new NotFoundException(`Leave with id ${leaveId} not found`);
    }

    leave.status = LeaveStatus.APPROVED;
    leave.updatedAt = new Date().toISOString();

    const updated = await this.repository.updateLeave(leave);

    if (this.auditService) {
      this.auditService.record({
        action: 'APPROVE_LEAVE',
        status: 'SUCCESS',
        input: { leaveId },
        output: updated
      });
    }

    return {
      success: true,
      data: updated,
      metadata: this.buildMetadata()
    };
  }

  async rejectLeave(leaveId: string): Promise<ApiResponse<Leave>> {
    if (!leaveId || leaveId.trim() === '') {
      throw new BadRequestException('Leave ID is required');
    }

    const leave = await this.repository.findLeaveById(leaveId);
    if (!leave) {
      throw new NotFoundException(`Leave with id ${leaveId} not found`);
    }

    leave.status = LeaveStatus.REJECTED;
    leave.updatedAt = new Date().toISOString();

    const updated = await this.repository.updateLeave(leave);

    if (this.auditService) {
      this.auditService.record({
        action: 'REJECT_LEAVE',
        status: 'SUCCESS',
        input: { leaveId },
        output: updated
      });
    }

    return {
      success: true,
      data: updated,
      metadata: this.buildMetadata()
    };
  }

  async listLeavesByEmployee(employeeId: string): Promise<ApiResponse<Leave[]>> {
    if (!employeeId || employeeId.trim() === '') {
      throw new BadRequestException('Employee ID is required');
    }

    const employee = await this.repository.findEmployeeById(employeeId);
    if (!employee) {
      throw new NotFoundException(`Employee with id ${employeeId} not found`);
    }

    const leaves = await this.repository.findLeavesByEmployee(employeeId);
    return {
      success: true,
      data: leaves,
      metadata: this.buildMetadata()
    };
  }

  async requestOvertime(dto: RequestOvertimeDto): Promise<ApiResponse<OvertimeRequest>> {
    if (!dto.employeeId || !dto.date || dto.hours === undefined || dto.hours === null) {
      throw new BadRequestException('Employee ID, date, and hours are required');
    }

    if (dto.hours <= 0) {
      throw new BadRequestException('Overtime hours must be greater than zero');
    }

    const employee = await this.repository.findEmployeeById(dto.employeeId);
    if (!employee) {
      throw new NotFoundException(`Employee with id ${dto.employeeId} not found`);
    }

    const estimatedCost = Number((dto.hours * (employee.hourlyRate ?? 25) * 1.5).toFixed(2));

    const overtimeRequest: OvertimeRequest = {
      id: randomUUID(),
      employeeId: dto.employeeId,
      date: dto.date,
      hours: dto.hours,
      reason: dto.reason,
      estimatedCost,
      status: OvertimeStatus.REQUESTED,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const created = await this.repository.createOvertimeRequest(overtimeRequest);

    if (this.auditService) {
      this.auditService.record({
        action: 'REQUEST_OVERTIME',
        status: 'SUCCESS',
        input: dto,
        output: created
      });
    }

    if (this.outboxService) {
      await this.outboxService.publish({
        aggregateType: 'OvertimeRequest',
        aggregateId: created.id,
        eventType: 'EmployeeOvertimeRequested',
        payload: {
          overtimeRequestId: created.id,
          employeeId: created.employeeId,
          hours: created.hours,
          date: created.date,
          estimatedCost: created.estimatedCost,
          status: created.status
        }
      });
    }

    return {
      success: true,
      data: created,
      metadata: this.buildMetadata()
    };
  }

  async approveOvertime(overtimeId: string): Promise<ApiResponse<OvertimeRequest>> {
    if (!overtimeId || overtimeId.trim() === '') {
      throw new BadRequestException('Overtime ID is required');
    }

    const request = await this.repository.findOvertimeRequestById(overtimeId);
    if (!request) {
      throw new NotFoundException(`Overtime request with id ${overtimeId} not found`);
    }

    request.status = OvertimeStatus.APPROVED;
    request.updatedAt = new Date().toISOString();

    const updated = await this.repository.updateOvertimeRequest(request);

    if (this.auditService) {
      this.auditService.record({
        action: 'APPROVE_OVERTIME',
        status: 'SUCCESS',
        input: { overtimeId },
        output: updated
      });
    }

    return {
      success: true,
      data: updated,
      metadata: this.buildMetadata()
    };
  }

  async rejectOvertime(overtimeId: string): Promise<ApiResponse<OvertimeRequest>> {
    if (!overtimeId || overtimeId.trim() === '') {
      throw new BadRequestException('Overtime ID is required');
    }

    const request = await this.repository.findOvertimeRequestById(overtimeId);
    if (!request) {
      throw new NotFoundException(`Overtime request with id ${overtimeId} not found`);
    }

    request.status = OvertimeStatus.REJECTED;
    request.updatedAt = new Date().toISOString();

    const updated = await this.repository.updateOvertimeRequest(request);

    if (this.auditService) {
      this.auditService.record({
        action: 'REJECT_OVERTIME',
        status: 'SUCCESS',
        input: { overtimeId },
        output: updated
      });
    }

    return {
      success: true,
      data: updated,
      metadata: this.buildMetadata()
    };
  }

  async listOvertimeRequestsByEmployee(employeeId: string): Promise<ApiResponse<OvertimeRequest[]>> {
    if (!employeeId || employeeId.trim() === '') {
      throw new BadRequestException('Employee ID is required');
    }

    const employee = await this.repository.findEmployeeById(employeeId);
    if (!employee) {
      throw new NotFoundException(`Employee with id ${employeeId} not found`);
    }

    const requests = await this.repository.findOvertimeRequestsByEmployee(employeeId);
    return {
      success: true,
      data: requests,
      metadata: this.buildMetadata()
    };
  }

  async listRecentOvertimeRequests(days = 30): Promise<ApiResponse<OvertimeRequest[]>> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const requests = await this.repository.findOvertimeRequestsSince(since);

    return {
      success: true,
      data: requests,
      metadata: this.buildMetadata()
    };
  }

  async getWorkloadSummary(departmentId: string): Promise<ApiResponse<WorkloadSummary>> {
    if (!departmentId || departmentId.trim() === '') {
      throw new BadRequestException('Department ID is required');
    }

    const department = await this.repository.findDepartmentById(departmentId);
    if (!department) {
      throw new NotFoundException(`Department with id ${departmentId} not found`);
    }

    const employees = await this.repository.findAllEmployees(departmentId);
    const employeeCount = employees.length;

    let totalOvertimeHoursLast30Days = 0;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentOvertime = await this.repository.findOvertimeRequestsSince(thirtyDaysAgo);

    for (const ot of recentOvertime) {
      if (employees.some((e) => e.id === ot.employeeId) && (ot.status === OvertimeStatus.APPROVED || ot.status === OvertimeStatus.REQUESTED)) {
        totalOvertimeHoursLast30Days += ot.hours;
      }
    }

    let openTicketCount = 0;
    if (this.ticketingService) {
      try {
        const tickets = await this.ticketingService.listTickets('OPEN');
        openTicketCount = tickets.data?.length || 0;
      } catch {
        openTicketCount = 0;
      }
    }

    const averageTicketsPerEmployee = employeeCount > 0 ? Number((openTicketCount / employeeCount).toFixed(2)) : 0;
    const isOverloaded = totalOvertimeHoursLast30Days >= employeeCount * 10 || averageTicketsPerEmployee > 5;

    const reasons: string[] = [];
    if (totalOvertimeHoursLast30Days >= employeeCount * 10) {
      reasons.push(`Total overtime (${totalOvertimeHoursLast30Days}h) reaches 10h/employee threshold`);
    }
    if (averageTicketsPerEmployee > 5) {
      reasons.push(`Open tickets per employee (${averageTicketsPerEmployee}) exceeds threshold of 5`);
    }

    const summary: WorkloadSummary = {
      departmentId,
      employeeCount,
      totalOvertimeHoursLast30Days,
      openTicketCount,
      averageTicketsPerEmployee,
      isOverloaded,
      reasons
    };

    return {
      success: true,
      data: summary,
      metadata: this.buildMetadata()
    };
  }
}
