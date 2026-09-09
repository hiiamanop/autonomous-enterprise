import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query
} from '@nestjs/common';
import { Role } from '@autonomous-enterprise/contracts';
import { RequirePermissions, Roles } from '../../common/auth/rbac.decorators';
import { Audit } from '../../common/audit/audit.decorators';
import { FinanceService } from './finance.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { CreateBudgetAllocationDto } from './dto/create-budget-allocation.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ApproveExpenseDto } from './dto/approve-expense.dto';

@Controller('api/v1/finance')
export class FinanceController {
  constructor(
    @Inject(FinanceService)
    private readonly financeService: FinanceService
  ) {}

  @Post('cost-centers')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER)
  @RequirePermissions('finance:write')
  @Audit('CREATE_COST_CENTER')
  createCostCenter(@Body() dto: CreateCostCenterDto) {
    return this.financeService.createCostCenter(dto);
  }

  @Get('cost-centers')
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER, Role.ACCOUNTANT, Role.AI_FINANCE_AGENT, Role.AI_ORCHESTRATOR)
  @RequirePermissions('finance:read')
  @Audit('LIST_COST_CENTERS')
  listCostCenters() {
    return this.financeService.listCostCenters();
  }

  @Get('cost-centers/:id')
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER, Role.ACCOUNTANT, Role.AI_FINANCE_AGENT, Role.AI_ORCHESTRATOR)
  @RequirePermissions('finance:read')
  @Audit('GET_COST_CENTER')
  getCostCenter(@Param('id') id: string) {
    return this.financeService.getCostCenter(id);
  }

  @Post('budgets')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER)
  @RequirePermissions('finance:write')
  @Audit('CREATE_BUDGET')
  createBudget(@Body() dto: CreateBudgetDto) {
    return this.financeService.createBudget(dto);
  }

  @Get('budgets')
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER, Role.ACCOUNTANT, Role.AI_FINANCE_AGENT, Role.AI_ORCHESTRATOR)
  @RequirePermissions('finance:read')
  @Audit('LIST_BUDGETS')
  listBudgets() {
    return this.financeService.listBudgets();
  }

  @Get('budgets/:id')
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER, Role.ACCOUNTANT, Role.AI_FINANCE_AGENT, Role.AI_ORCHESTRATOR)
  @RequirePermissions('finance:read')
  @Audit('GET_BUDGET')
  getBudget(@Param('id') id: string) {
    return this.financeService.getBudget(id);
  }

  @Post('budget-allocations')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER)
  @RequirePermissions('finance:write')
  @Audit('CREATE_BUDGET_ALLOCATION')
  createBudgetAllocation(@Body() dto: CreateBudgetAllocationDto) {
    return this.financeService.createBudgetAllocation(dto);
  }

  @Get('budget-allocations')
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER, Role.ACCOUNTANT, Role.AI_FINANCE_AGENT, Role.AI_ORCHESTRATOR)
  @RequirePermissions('finance:read')
  @Audit('LIST_BUDGET_ALLOCATIONS')
  listBudgetAllocations(@Query('budgetId') budgetId?: string) {
    return this.financeService.listBudgetAllocations(budgetId);
  }

  @Post('expenses')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER, Role.EMPLOYEE, Role.AI_FINANCE_AGENT)
  @RequirePermissions('finance:write')
  @Audit('CREATE_EXPENSE')
  createExpense(@Body() dto: CreateExpenseDto) {
    return this.financeService.createExpense(dto);
  }

  @Get('expenses')
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER, Role.ACCOUNTANT, Role.AI_FINANCE_AGENT, Role.AI_ORCHESTRATOR)
  @RequirePermissions('finance:read')
  @Audit('LIST_EXPENSES')
  listExpenses() {
    return this.financeService.listExpenses();
  }

  @Get('expenses/:id')
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER, Role.ACCOUNTANT, Role.AI_FINANCE_AGENT, Role.AI_ORCHESTRATOR)
  @RequirePermissions('finance:read')
  @Audit('GET_EXPENSE')
  getExpense(@Param('id') id: string) {
    return this.financeService.getExpense(id);
  }

  @Post('expenses/:id/approve')
  @HttpCode(200)
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER, Role.AI_FINANCE_AGENT)
  @RequirePermissions('finance:approve')
  @Audit('APPROVE_EXPENSE')
  approveExpense(@Param('id') id: string, @Body() dto: ApproveExpenseDto) {
    return this.financeService.approveExpense(id, dto);
  }

  @Post('expenses/:id/reject')
  @HttpCode(200)
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER, Role.AI_FINANCE_AGENT)
  @RequirePermissions('finance:approve')
  @Audit('REJECT_EXPENSE')
  rejectExpense(@Param('id') id: string) {
    return this.financeService.rejectExpense(id);
  }
}
