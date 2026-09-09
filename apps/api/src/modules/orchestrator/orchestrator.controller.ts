import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { Role, type ApiResponse } from '@autonomous-enterprise/contracts';
import { TenantContextStorage } from '@autonomous-enterprise/shared';
import { RequirePermissions, Roles } from '../../common/auth/rbac.decorators';
import { Audit } from '../../common/audit/audit.decorators';
import { OrchestratorService, type GoalExecutionResult } from './orchestrator.service';
import { ExecuteGoalDto } from './dto/execute-goal.dto';

@Controller('api/v1/orchestrator')
export class OrchestratorController {
  constructor(
    @Inject(OrchestratorService) private readonly orchestratorService: OrchestratorService
  ) {}

  @Post('goals')
  @HttpCode(200)
  @Roles(Role.TENANT_ADMIN, Role.AI_ORCHESTRATOR)
  @RequirePermissions('orchestrator:execute')
  @Audit('EXECUTE_ORCHESTRATOR_GOAL')
  async executeGoal(@Body() dto: ExecuteGoalDto): Promise<ApiResponse<GoalExecutionResult>> {
    const result = await this.orchestratorService.executeGoal(dto);
    return {
      success: true,
      data: result,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }
}
