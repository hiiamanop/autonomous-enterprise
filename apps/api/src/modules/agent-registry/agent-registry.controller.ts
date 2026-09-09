import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put
} from '@nestjs/common';
import { Role } from '@autonomous-enterprise/contracts';
import { RequirePermissions, Roles } from '../../common/auth/rbac.decorators';
import { Audit } from '../../common/audit/audit.decorators';
import { AgentRegistryService } from './agent-registry.service';
import { RegisterAgentDto } from './dto/register-agent.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { RecordTrustOutcomeDto } from './dto/record-trust-outcome.dto';
import { UpdateTrustProfileDto } from './dto/update-trust-profile.dto';

@Controller('api/v1/agent-registry')
export class AgentRegistryController {
  constructor(
    @Inject(AgentRegistryService)
    private readonly service: AgentRegistryService
  ) {}

  @Post()
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.AI_ORCHESTRATOR)
  @RequirePermissions('agent-registry:write')
  @Audit('REGISTER_AGENT')
  registerAgent(@Body() dto: RegisterAgentDto) {
    return this.service.registerAgent(dto);
  }

  @Post('register')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.AI_ORCHESTRATOR)
  @RequirePermissions('agent-registry:write')
  @Audit('REGISTER_AGENT')
  registerAgentAlias(@Body() dto: RegisterAgentDto) {
    return this.service.registerAgent(dto);
  }

  @Get()
  @Roles(
    Role.TENANT_ADMIN,
    Role.AI_ORCHESTRATOR,
    Role.OPERATOR,
    Role.SUPER_ADMIN
  )
  @RequirePermissions('agent-registry:read')
  @Audit('LIST_AGENTS')
  listAgents() {
    return this.service.listAgents();
  }

  @Get(':agentName')
  @Roles(
    Role.TENANT_ADMIN,
    Role.AI_ORCHESTRATOR,
    Role.OPERATOR,
    Role.SUPER_ADMIN
  )
  @RequirePermissions('agent-registry:read')
  @Audit('GET_AGENT')
  getAgent(@Param('agentName') agentName: string) {
    return this.service.getAgent(agentName);
  }

  @Post(':agentName/availability')
  @HttpCode(200)
  @Roles(Role.TENANT_ADMIN, Role.AI_ORCHESTRATOR)
  @RequirePermissions('agent-registry:write')
  @Audit('UPDATE_AGENT_AVAILABILITY')
  updateAvailability(
    @Param('agentName') agentName: string,
    @Body() dto: UpdateAvailabilityDto
  ) {
    return this.service.updateAvailability(agentName, dto.availability);
  }

  @Patch(':agentName/availability')
  @Roles(Role.TENANT_ADMIN, Role.AI_ORCHESTRATOR)
  @RequirePermissions('agent-registry:write')
  @Audit('UPDATE_AGENT_AVAILABILITY')
  patchAvailability(
    @Param('agentName') agentName: string,
    @Body() dto: UpdateAvailabilityDto
  ) {
    return this.service.updateAvailability(agentName, dto.availability);
  }

  @Post(':agentName/trust-outcome')
  @HttpCode(200)
  @Roles(Role.TENANT_ADMIN, Role.AI_ORCHESTRATOR)
  @RequirePermissions('agent-registry:write')
  @Audit('RECORD_TRUST_OUTCOME')
  recordTrustOutcome(
    @Param('agentName') agentName: string,
    @Body() dto: RecordTrustOutcomeDto
  ) {
    return this.service.recordTrustOutcome(agentName, dto);
  }

  @Post(':agentName/outcomes')
  @HttpCode(200)
  @Roles(Role.TENANT_ADMIN, Role.AI_ORCHESTRATOR)
  @RequirePermissions('agent-registry:write')
  @Audit('RECORD_TRUST_OUTCOME')
  recordTrustOutcomeAlias(
    @Param('agentName') agentName: string,
    @Body() dto: RecordTrustOutcomeDto
  ) {
    return this.service.recordTrustOutcome(agentName, dto);
  }

  @Put(':agentName/trust-profile')
  @Roles(Role.TENANT_ADMIN, Role.AI_ORCHESTRATOR)
  @RequirePermissions('agent-registry:write')
  @Audit('UPDATE_TRUST_PROFILE')
  updateTrustProfile(
    @Param('agentName') agentName: string,
    @Body() dto: UpdateTrustProfileDto
  ) {
    return this.service.updateTrustProfile(agentName, dto);
  }

  @Patch(':agentName/trust-profile')
  @Roles(Role.TENANT_ADMIN, Role.AI_ORCHESTRATOR)
  @RequirePermissions('agent-registry:write')
  @Audit('UPDATE_TRUST_PROFILE')
  patchTrustProfile(
    @Param('agentName') agentName: string,
    @Body() dto: UpdateTrustProfileDto
  ) {
    return this.service.updateTrustProfile(agentName, dto);
  }
}
