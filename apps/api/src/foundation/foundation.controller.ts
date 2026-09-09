import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { Role, type ApiResponse, type AuditRecord } from '@autonomous-enterprise/contracts';
import { CurrentTenantId } from '../common/tenant/tenant.decorators';
import { Public } from '../common/auth/tenant.guard';
import { RequirePermissions, Roles } from '../common/auth/rbac.decorators';
import { Audit } from '../common/audit/audit.decorators';
import { AuditService } from '../common/audit/audit.service';
import { AgentContractService } from '../common/agent/agent-contract.service';
import { FoundationService } from './foundation.service';

@Controller('api/v1')
export class FoundationController {
  constructor(
    @Inject(FoundationService) private readonly foundationService: FoundationService,
    @Inject(AgentContractService) private readonly agentContractService: AgentContractService,
    @Inject(AuditService) private readonly auditService: AuditService
  ) {}

  @Get('health')
  @Public()
  getHealth(): { status: string } {
    return { status: 'ok' };
  }

  @Get('tenant/profile')
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR, Role.AUDITOR)
  @RequirePermissions('tenant:read')
  @Audit('VIEW_TENANT_PROFILE')
  getTenantProfile() {
    return this.foundationService.getTenantProfile();
  }

  @Get('protected/user-only')
  @Roles(Role.TENANT_ADMIN, Role.SALES_MANAGER)
  @Audit('EXECUTE_USER_ACTION')
  executeUserAction() {
    return this.foundationService.executeUserAction();
  }

  @Post('protected/agent-action')
  @HttpCode(200)
  @Roles(Role.AI_SALES_AGENT, Role.AI_ORCHESTRATOR)
  @RequirePermissions('agent:execute')
  @Audit('EXECUTE_AGENT_ACTION')
  executeAgentAction() {
    return this.foundationService.executeAgentAction();
  }

  @Post('agent/message')
  @HttpCode(200)
  @Roles(
    Role.AI_SALES_AGENT,
    Role.AI_FINANCE_AGENT,
    Role.AI_INFRA_AGENT,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('agent:execute')
  @Audit('PROCESS_AGENT_MESSAGE')
  processAgentMessage(@Body() body: unknown) {
    return this.agentContractService.processMessage(body);
  }

  @Get('audit/logs')
  @Roles(Role.AUDITOR, Role.TENANT_ADMIN)
  @RequirePermissions('audit:read')
  @Audit('LIST_AUDIT_LOGS')
  getAuditLogs(): ApiResponse<AuditRecord[]> {
    const logs = this.auditService.getLogs();
    return {
      success: true,
      data: logs,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }
}
