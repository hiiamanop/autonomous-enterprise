import { Body, Controller, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import { Role } from '@autonomous-enterprise/contracts';
import { RequirePermissions, Roles } from '../../common/auth/rbac.decorators';
import { Audit } from '../../common/audit/audit.decorators';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { ProcessOrderFulfillmentDto } from './dto/process-order-fulfillment.dto';
import { PurchaseApprovalService } from './purchase-approval.service';
import { ProcessPurchaseApprovalDto } from './dto/process-purchase-approval.dto';
import { FinancialPostingService } from './financial-posting.service';
import { ProcessFinancialPostingDto } from './dto/process-financial-posting.dto';
import { OvertimeApprovalService } from './overtime-approval.service';
import { ProcessOvertimeApprovalDto } from './dto/process-overtime-approval.dto';
import { EnterpriseSagaService } from './enterprise-saga.service';
import { ProcessEnterpriseSagaDto } from './dto/process-enterprise-saga.dto';

@Controller('api/v1/workflows')
export class WorkflowController {
  constructor(
    @Inject(OrderFulfillmentService)
    private readonly orderFulfillmentService: OrderFulfillmentService,
    @Inject(PurchaseApprovalService)
    private readonly purchaseApprovalService: PurchaseApprovalService,
    @Inject(FinancialPostingService)
    private readonly financialPostingService: FinancialPostingService,
    @Inject(OvertimeApprovalService)
    private readonly overtimeApprovalService: OvertimeApprovalService,
    @Inject(EnterpriseSagaService)
    private readonly enterpriseSagaService: EnterpriseSagaService
  ) {}

  @Post('order-fulfillment')
  @HttpCode(200)
  @Roles(
    Role.TENANT_ADMIN,
    Role.SALES_MANAGER,
    Role.INVENTORY_MANAGER,
    Role.OPERATOR,
    Role.AI_ORCHESTRATOR,
    Role.AI_SALES_AGENT
  )
  @RequirePermissions('sales:write', 'inventory:write')
  @Audit('PROCESS_ORDER_FULFILLMENT_WORKFLOW')
  processOrderFulfillment(
    @Body() dto: ProcessOrderFulfillmentDto,
    @Headers('x-idempotency-key') idempotencyHeader?: string
  ) {
    return this.orderFulfillmentService.processOrderFulfillment(dto, idempotencyHeader);
  }

  @Post('purchase-approval')
  @HttpCode(200)
  @Roles(
    Role.TENANT_ADMIN,
    Role.PROCUREMENT_MANAGER,
    Role.FINANCE_MANAGER,
    Role.OPERATOR,
    Role.AI_ORCHESTRATOR,
    Role.AI_FINANCE_AGENT
  )
  @RequirePermissions('procurement:write', 'finance:write')
  @Audit('PROCESS_PURCHASE_APPROVAL_WORKFLOW')
  processPurchaseApproval(
    @Body() dto: ProcessPurchaseApprovalDto,
    @Headers('x-idempotency-key') idempotencyHeader?: string
  ) {
    return this.purchaseApprovalService.processPurchaseApproval(dto, idempotencyHeader);
  }

  @Post('financial-posting')
  @HttpCode(200)
  @Roles(
    Role.TENANT_ADMIN,
    Role.ACCOUNTANT,
    Role.FINANCE_MANAGER,
    Role.AI_FINANCE_AGENT,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('accounting:write')
  @Audit('PROCESS_FINANCIAL_POSTING_WORKFLOW')
  processFinancialPosting(
    @Body() dto: ProcessFinancialPostingDto,
    @Headers('x-idempotency-key') idempotencyHeader?: string
  ) {
    return this.financialPostingService.processFinancialPosting(dto, idempotencyHeader);
  }

  @Post('overtime-approval')
  @HttpCode(200)
  @Roles(
    Role.TENANT_ADMIN,
    Role.HR_MANAGER,
    Role.FINANCE_MANAGER,
    Role.OPERATOR,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('hris:write', 'finance:write')
  @Audit('PROCESS_OVERTIME_APPROVAL_WORKFLOW')
  processOvertimeApproval(@Body() dto: ProcessOvertimeApprovalDto) {
    return this.overtimeApprovalService.processOvertimeApproval(dto);
  }

  @Post('enterprise-saga')
  @HttpCode(200)
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR, Role.AI_ORCHESTRATOR)
  @RequirePermissions(
    'sales:write', 'inventory:write', 'procurement:write', 'finance:write',
    'accounting:write', 'hris:write', 'infrastructure:write'
  )
  @Audit('PROCESS_ENTERPRISE_SAGA')
  processEnterpriseSaga(@Body() dto: ProcessEnterpriseSagaDto) {
    return this.enterpriseSagaService.process(dto);
  }
}
