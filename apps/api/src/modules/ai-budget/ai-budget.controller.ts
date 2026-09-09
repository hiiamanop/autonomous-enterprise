import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { Role, type ApiResponse } from '@autonomous-enterprise/contracts';
import { TenantContextStorage } from '@autonomous-enterprise/shared';
import { RequirePermissions, Roles } from '../../common/auth/rbac.decorators';
import { Audit } from '../../common/audit/audit.decorators';
import { AiBudgetService } from './ai-budget.service';
import { SetBudgetDto } from './dto/set-budget.dto';
import type { AiBudgetStatus, TenantAiBudget } from './domain/ai-budget.types';

@Controller('api/v1/ai-budget')
export class AiBudgetController {
  constructor(
    @Inject(AiBudgetService) private readonly aiBudgetService: AiBudgetService
  ) {}

  private wrap<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }

  @Get('status')
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER, Role.AI_ORCHESTRATOR)
  @RequirePermissions('ai-budget:read')
  @Audit('GET_AI_BUDGET_STATUS')
  async getStatus(): Promise<ApiResponse<AiBudgetStatus>> {
    const status = await this.aiBudgetService.getStatus();
    return this.wrap(status);
  }

  @Get('agent-usage')
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER, Role.AI_ORCHESTRATOR, Role.AUDITOR)
  @RequirePermissions('ai-budget:read')
  @Audit('GET_AI_AGENT_USAGE')
  async getAgentUsage(): Promise<ApiResponse<unknown>> {
    const usage = await this.aiBudgetService.getAgentUsageBreakdown();
    return this.wrap(usage);
  }

  @Post('configure')
  @HttpCode(200)
  @Roles(Role.TENANT_ADMIN, Role.FINANCE_MANAGER)
  @RequirePermissions('ai-budget:write')
  @Audit('CONFIGURE_AI_BUDGET')
  async configure(@Body() dto: SetBudgetDto): Promise<ApiResponse<TenantAiBudget>> {
    const budget = await this.aiBudgetService.setBudget(dto);
    return this.wrap(budget);
  }
}
