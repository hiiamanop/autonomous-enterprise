import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { Role } from '@autonomous-enterprise/contracts';
import { RequirePermissions, Roles } from '../../common/auth/rbac.decorators';
import { Audit } from '../../common/audit/audit.decorators';
import { InfrastructureService } from './infrastructure.service';
import { RequestScalingDto } from './dto/request-scaling.dto';

@Controller('api/v1/infrastructure')
export class InfrastructureController {
  constructor(
    @Inject(InfrastructureService) private readonly infrastructureService: InfrastructureService
  ) {}

  @Get('cluster-snapshot')
  @Roles(
    Role.TENANT_ADMIN,
    Role.OPERATOR,
    Role.AUDITOR,
    Role.AI_INFRA_AGENT,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('infrastructure:read')
  @Audit('GET_CLUSTER_SNAPSHOT')
  getClusterSnapshot(@Query('namespace') namespace = 'autonomous-enterprise') {
    return this.infrastructureService.getClusterSnapshot(namespace);
  }

  @Get('scaling-events')
  @Roles(
    Role.TENANT_ADMIN,
    Role.OPERATOR,
    Role.AUDITOR,
    Role.FINANCE_MANAGER,
    Role.AI_INFRA_AGENT,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('infrastructure:read')
  @Audit('LIST_SCALING_EVENTS')
  listScalingEvents(@Query('deploymentName') deploymentName?: string) {
    return this.infrastructureService.listScalingEvents(deploymentName);
  }

  @Get('scaling-events/:id')
  @Roles(
    Role.TENANT_ADMIN,
    Role.OPERATOR,
    Role.AUDITOR,
    Role.FINANCE_MANAGER,
    Role.AI_INFRA_AGENT,
    Role.AI_ORCHESTRATOR
  )
  @RequirePermissions('infrastructure:read')
  @Audit('GET_SCALING_EVENT')
  getScalingEvent(@Param('id') id: string) {
    return this.infrastructureService.getScalingEvent(id);
  }

  @Post('scaling-requests')
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR, Role.AI_INFRA_AGENT, Role.AI_ORCHESTRATOR)
  @RequirePermissions('infrastructure:write')
  @Audit('REQUEST_INFRA_SCALING')
  requestScaling(@Body() dto: RequestScalingDto) {
    return this.infrastructureService.requestScaling(dto);
  }

  @Post('scaling-events/:id/rollback')
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR, Role.AI_INFRA_AGENT)
  @RequirePermissions('infrastructure:write')
  @Audit('ROLLBACK_INFRA_SCALING')
  rollbackScaling(@Param('id') id: string) {
    return this.infrastructureService.rollbackScaling(id);
  }
}
