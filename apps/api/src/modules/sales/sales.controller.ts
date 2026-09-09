import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@autonomous-enterprise/contracts';
import { RequirePermissions, Roles } from '../../common/auth/rbac.decorators';
import { Audit } from '../../common/audit/audit.decorators';
import { SalesService } from './sales.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderStatusDto } from './dto/update-sales-order-status.dto';
import { CreateSalesRepDto, AssignLeadDto, CloseLeadDto } from './dto/sales-rep.dto';

@Controller('api/v1/sales')
export class SalesController {
  constructor(
    @Inject(SalesService) private readonly salesService: SalesService
  ) {}

  @Post('customers')
  @Roles(Role.TENANT_ADMIN, Role.SALES_MANAGER, Role.EMPLOYEE)
  @RequirePermissions('sales:write')
  @Audit('CREATE_CUSTOMER')
  createCustomer(@Body() dto: CreateCustomerDto) {
    return this.salesService.createCustomer(dto);
  }

  @Get('customers')
  @Roles(Role.TENANT_ADMIN, Role.SALES_MANAGER, Role.EMPLOYEE, Role.AI_SALES_AGENT)
  @RequirePermissions('sales:read')
  @Audit('LIST_CUSTOMERS')
  listCustomers() {
    return this.salesService.listCustomers();
  }

  @Get('customers/:id')
  @Roles(Role.TENANT_ADMIN, Role.SALES_MANAGER, Role.EMPLOYEE, Role.AI_SALES_AGENT)
  @RequirePermissions('sales:read')
  @Audit('GET_CUSTOMER')
  getCustomer(@Param('id') id: string) {
    return this.salesService.getCustomer(id);
  }

  @Post('orders')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.SALES_MANAGER, Role.EMPLOYEE, Role.AI_SALES_AGENT)
  @RequirePermissions('sales:write')
  @Audit('CREATE_SALES_ORDER')
  createSalesOrder(
    @Body() dto: CreateSalesOrderDto,
    @Headers('x-idempotency-key') idempotencyHeader?: string
  ) {
    return this.salesService.createSalesOrder(dto, idempotencyHeader);
  }

  @Get('orders')
  @Roles(Role.TENANT_ADMIN, Role.SALES_MANAGER, Role.EMPLOYEE, Role.AI_SALES_AGENT)
  @RequirePermissions('sales:read')
  @Audit('LIST_SALES_ORDERS')
  listSalesOrders() {
    return this.salesService.listSalesOrders();
  }

  @Get('orders/:id')
  @Roles(Role.TENANT_ADMIN, Role.SALES_MANAGER, Role.EMPLOYEE, Role.AI_SALES_AGENT)
  @RequirePermissions('sales:read')
  @Audit('GET_SALES_ORDER')
  getSalesOrder(@Param('id') id: string) {
    return this.salesService.getSalesOrder(id);
  }

  @Patch('orders/:id/status')
  @Roles(Role.TENANT_ADMIN, Role.SALES_MANAGER)
  @RequirePermissions('sales:approve')
  @Audit('UPDATE_SALES_ORDER_STATUS')
  updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSalesOrderStatusDto
  ) {
    return this.salesService.updateOrderStatus(id, dto.status);
  }

  @Post('reps')
  @Roles(Role.TENANT_ADMIN, Role.SALES_MANAGER)
  @RequirePermissions('sales:write')
  @Audit('CREATE_SALES_REP')
  createSalesRep(@Body() dto: CreateSalesRepDto) {
    return this.salesService.createSalesRep(dto);
  }

  @Get('reps')
  @Roles(Role.TENANT_ADMIN, Role.SALES_MANAGER, Role.EMPLOYEE, Role.AI_SALES_AGENT, Role.AUDITOR)
  @RequirePermissions('sales:read')
  @Audit('LIST_SALES_REPS')
  listSalesReps() {
    return this.salesService.listSalesReps();
  }

  @Get('reps/kpi')
  @Roles(Role.TENANT_ADMIN, Role.SALES_MANAGER, Role.EMPLOYEE, Role.AI_SALES_AGENT, Role.AUDITOR)
  @RequirePermissions('sales:read')
  @Audit('GET_SALES_REP_KPI')
  getSalesRepKpis() {
    return this.salesService.getSalesRepKpis();
  }

  @Get('channels/summary')
  @Roles(Role.TENANT_ADMIN, Role.SALES_MANAGER, Role.EMPLOYEE, Role.AI_SALES_AGENT, Role.AUDITOR)
  @RequirePermissions('sales:read')
  @Audit('GET_CHANNEL_SUMMARY')
  getChannelSummary() {
    return this.salesService.getChannelSummary();
  }

  @Patch('leads/:id/assign')
  @HttpCode(200)
  @Roles(Role.TENANT_ADMIN, Role.SALES_MANAGER, Role.AI_SALES_AGENT)
  @RequirePermissions('sales:write')
  @Audit('ASSIGN_SALES_LEAD')
  assignLead(@Param('id') id: string, @Body() dto: AssignLeadDto) {
    return this.salesService.assignLead(id, dto.repId);
  }

  @Patch('leads/:id/close')
  @HttpCode(200)
  @Roles(Role.TENANT_ADMIN, Role.SALES_MANAGER, Role.EMPLOYEE, Role.AI_SALES_AGENT)
  @RequirePermissions('sales:write')
  @Audit('CLOSE_SALES_LEAD')
  closeLead(@Param('id') id: string, @Body() dto: CloseLeadDto) {
    return this.salesService.closeLead(id, dto);
  }
}
