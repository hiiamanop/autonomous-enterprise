import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query
} from '@nestjs/common';
import { Role } from '@autonomous-enterprise/contracts';
import { RequirePermissions, Roles } from '../../common/auth/rbac.decorators';
import { Audit } from '../../common/audit/audit.decorators';
import { HrisService } from './hris.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { RequestLeaveDto } from './dto/request-leave.dto';
import { RequestOvertimeDto } from './dto/request-overtime.dto';

@Controller('api/v1/hris')
export class HrisController {
  constructor(
    @Inject(HrisService)
    private readonly hrisService: HrisService
  ) {}

  @Post('departments')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.HR_MANAGER)
  @RequirePermissions('hris:write')
  @Audit('CREATE_DEPARTMENT')
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.hrisService.createDepartment(dto);
  }

  @Get('departments')
  @Roles(
    Role.TENANT_ADMIN,
    Role.HR_MANAGER,
    Role.OPERATOR,
    Role.AUDITOR,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('hris:read')
  @Audit('LIST_DEPARTMENTS')
  listDepartments() {
    return this.hrisService.listDepartments();
  }

  @Get('departments/:id')
  @Roles(
    Role.TENANT_ADMIN,
    Role.HR_MANAGER,
    Role.OPERATOR,
    Role.AUDITOR,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('hris:read')
  @Audit('GET_DEPARTMENT')
  getDepartment(@Param('id') id: string) {
    return this.hrisService.getDepartment(id);
  }

  @Get('departments/:id/workload')
  @Roles(
    Role.TENANT_ADMIN,
    Role.HR_MANAGER,
    Role.OPERATOR,
    Role.AUDITOR,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('hris:read')
  @Audit('GET_WORKLOAD_SUMMARY')
  getWorkloadSummary(@Param('id') id: string) {
    return this.hrisService.getWorkloadSummary(id);
  }

  @Get('deliveries')
  @Roles(
    Role.TENANT_ADMIN,
    Role.HR_MANAGER,
    Role.OPERATOR,
    Role.AUDITOR,
    Role.INVENTORY_MANAGER,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('hris:read')
  @Audit('LIST_DELIVERIES')
  listDeliveries() {
    return this.hrisService.listDeliveries();
  }

  @Get('overtime')
  @Roles(
    Role.TENANT_ADMIN,
    Role.HR_MANAGER,
    Role.OPERATOR,
    Role.AUDITOR,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('hris:read')
  @Audit('LIST_OVERTIME_REQUESTS')
  listRecentOvertimeRequests(@Query('days') days?: string) {
    const parsed = Number(days);
    return this.hrisService.listRecentOvertimeRequests(
      Number.isFinite(parsed) && parsed > 0 ? parsed : 30
    );
  }

  @Post('departments/:id/assess-staffing')
  @HttpCode(200)
  @Roles(Role.TENANT_ADMIN, Role.HR_MANAGER, Role.OPERATOR, Role.AI_ORCHESTRATOR)
  @RequirePermissions('hris:write')
  @Audit('ASSESS_STAFFING')
  assessStaffing(
    @Param('id') id: string,
    @Body() dto: { pendingOrders: number; ordersReadyToShip?: Array<{ orderId: string; orderNumber: string }> }
  ) {
    return this.hrisService.assessStaffing({
      departmentId: id,
      pendingOrders: dto?.pendingOrders ?? 0,
      ordersReadyToShip: dto?.ordersReadyToShip
    });
  }

  @Post('employees')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.HR_MANAGER)
  @RequirePermissions('hris:write')
  @Audit('CREATE_EMPLOYEE')
  createEmployee(@Body() dto: CreateEmployeeDto) {
    return this.hrisService.createEmployee(dto);
  }

  @Get('employees')
  @Roles(
    Role.TENANT_ADMIN,
    Role.HR_MANAGER,
    Role.OPERATOR,
    Role.AUDITOR,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('hris:read')
  @Audit('LIST_EMPLOYEES')
  listEmployees(@Query('departmentId') departmentId?: string) {
    return this.hrisService.listEmployees(departmentId);
  }

  @Get('employees/:id')
  @Roles(
    Role.TENANT_ADMIN,
    Role.HR_MANAGER,
    Role.OPERATOR,
    Role.AUDITOR,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('hris:read')
  @Audit('GET_EMPLOYEE')
  getEmployee(@Param('id') id: string) {
    return this.hrisService.getEmployee(id);
  }

  @Patch('employees/:id')
  @Roles(Role.TENANT_ADMIN, Role.HR_MANAGER)
  @RequirePermissions('hris:write')
  @Audit('UPDATE_EMPLOYEE')
  patchEmployee(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.hrisService.updateEmployee(id, dto);
  }

  @Put('employees/:id')
  @Roles(Role.TENANT_ADMIN, Role.HR_MANAGER)
  @RequirePermissions('hris:write')
  @Audit('UPDATE_EMPLOYEE')
  putEmployee(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.hrisService.updateEmployee(id, dto);
  }

  @Post('attendance')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.HR_MANAGER, Role.OPERATOR)
  @RequirePermissions('hris:write')
  @Audit('RECORD_ATTENDANCE')
  recordAttendance(@Body() dto: RecordAttendanceDto) {
    return this.hrisService.recordAttendance(dto);
  }

  @Post('attendance/:id/clock-out')
  @Roles(Role.TENANT_ADMIN, Role.HR_MANAGER, Role.OPERATOR)
  @RequirePermissions('hris:write')
  @Audit('CLOCK_OUT')
  clockOut(@Param('id') id: string) {
    return this.hrisService.clockOut(id);
  }

  @Get('attendance/employee/:employeeId')
  @Roles(
    Role.TENANT_ADMIN,
    Role.HR_MANAGER,
    Role.OPERATOR,
    Role.AUDITOR,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('hris:read')
  @Audit('LIST_ATTENDANCE_BY_EMPLOYEE')
  listAttendanceByEmployee(@Param('employeeId') employeeId: string) {
    return this.hrisService.listAttendanceByEmployee(employeeId);
  }

  @Post('leaves')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.HR_MANAGER, Role.OPERATOR)
  @RequirePermissions('hris:write')
  @Audit('REQUEST_LEAVE')
  requestLeave(@Body() dto: RequestLeaveDto) {
    return this.hrisService.requestLeave(dto);
  }

  @Post('leaves/:id/approve')
  @Roles(Role.TENANT_ADMIN, Role.HR_MANAGER)
  @RequirePermissions('hris:write')
  @Audit('APPROVE_LEAVE')
  approveLeave(@Param('id') id: string) {
    return this.hrisService.approveLeave(id);
  }

  @Post('leaves/:id/reject')
  @Roles(Role.TENANT_ADMIN, Role.HR_MANAGER)
  @RequirePermissions('hris:write')
  @Audit('REJECT_LEAVE')
  rejectLeave(@Param('id') id: string) {
    return this.hrisService.rejectLeave(id);
  }

  @Get('leaves/employee/:employeeId')
  @Roles(
    Role.TENANT_ADMIN,
    Role.HR_MANAGER,
    Role.OPERATOR,
    Role.AUDITOR,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('hris:read')
  @Audit('LIST_LEAVES_BY_EMPLOYEE')
  listLeavesByEmployee(@Param('employeeId') employeeId: string) {
    return this.hrisService.listLeavesByEmployee(employeeId);
  }

  @Post('overtime')
  @HttpCode(201)
  @Roles(
    Role.TENANT_ADMIN,
    Role.HR_MANAGER,
    Role.AI_ORCHESTRATOR,
    Role.OPERATOR
  )
  @RequirePermissions('hris:write')
  @Audit('REQUEST_OVERTIME')
  requestOvertime(@Body() dto: RequestOvertimeDto) {
    return this.hrisService.requestOvertime(dto);
  }

  @Post('overtime/:id/approve')
  @Roles(Role.TENANT_ADMIN, Role.HR_MANAGER)
  @RequirePermissions('hris:write')
  @Audit('APPROVE_OVERTIME')
  approveOvertime(@Param('id') id: string) {
    return this.hrisService.approveOvertime(id);
  }

  @Post('overtime/:id/reject')
  @Roles(Role.TENANT_ADMIN, Role.HR_MANAGER)
  @RequirePermissions('hris:write')
  @Audit('REJECT_OVERTIME')
  rejectOvertime(@Param('id') id: string) {
    return this.hrisService.rejectOvertime(id);
  }

  @Get('overtime/employee/:employeeId')
  @Roles(
    Role.TENANT_ADMIN,
    Role.HR_MANAGER,
    Role.OPERATOR,
    Role.AUDITOR,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('hris:read')
  @Audit('LIST_OVERTIME_BY_EMPLOYEE')
  listOvertimeRequestsByEmployee(@Param('employeeId') employeeId: string) {
    return this.hrisService.listOvertimeRequestsByEmployee(employeeId);
  }
}
