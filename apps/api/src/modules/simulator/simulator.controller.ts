import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { Role } from '@autonomous-enterprise/contracts';
import { RequirePermissions, Roles } from '../../common/auth/rbac.decorators';
import { Audit } from '../../common/audit/audit.decorators';
import { RateLimitSupervisorService } from '../../common/ai-provider/rate-limit-supervisor.service';
import { SimulatorService } from './simulator.service';
import type { SimulatorConfigDto, SimulatorStatus } from './simulator.types';

@Controller('api/v1/simulator')
export class SimulatorController {
  constructor(
    @Inject(SimulatorService) private readonly simulatorService: SimulatorService,
    @Inject(RateLimitSupervisorService) private readonly rateLimitSupervisor: RateLimitSupervisorService
  ) {}

  @Get('status')
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR, Role.AUDITOR)
  @RequirePermissions('observability:read')
  @Audit('GET_SIMULATOR_STATUS')
  getStatus(): { success: true; data: SimulatorStatus } {
    return { success: true, data: this.simulatorService.getStatus() };
  }

  @Post('start')
  @HttpCode(200)
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR)
  @RequirePermissions('observability:read')
  @Audit('START_SIMULATOR')
  start(@Body() config?: SimulatorConfigDto): { success: true; data: SimulatorStatus } {
    return { success: true, data: this.simulatorService.start(config) };
  }

  @Post('stop')
  @HttpCode(200)
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR)
  @RequirePermissions('observability:read')
  @Audit('STOP_SIMULATOR')
  stop(): { success: true; data: SimulatorStatus } {
    return { success: true, data: this.simulatorService.stop() };
  }

  @Post('config')
  @HttpCode(200)
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR)
  @RequirePermissions('observability:read')
  @Audit('CONFIG_SIMULATOR')
  updateConfig(@Body() config: SimulatorConfigDto): { success: true; data: SimulatorStatus } {
    return { success: true, data: this.simulatorService.updateConfig(config) };
  }

  @Post('pause-cooldown')
  @HttpCode(200)
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR)
  @RequirePermissions('observability:read')
  @Audit('TRIGGER_SIMULATOR_COOLDOWN')
  triggerCooldown(@Body() body?: { seconds?: number; reason?: string }) {
    const status = this.rateLimitSupervisor.manualPause(
      body?.seconds || 30,
      body?.reason || 'Simulated provider rate limit triggered by operator'
    );
    return { success: true, data: status };
  }

  @Post('resume')
  @HttpCode(200)
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR)
  @RequirePermissions('observability:read')
  @Audit('RESUME_SIMULATOR_COOLDOWN')
  resumeCooldown() {
    const status = this.rateLimitSupervisor.manualResume();
    return { success: true, data: status };
  }
}
