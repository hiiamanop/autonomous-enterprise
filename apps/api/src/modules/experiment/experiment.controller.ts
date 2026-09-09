import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { Role } from '@autonomous-enterprise/contracts';
import { RequirePermissions, Roles } from '../../common/auth/rbac.decorators';
import { Audit } from '../../common/audit/audit.decorators';
import { ExperimentService } from './experiment.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { RunExperimentDto } from './dto/run-experiment.dto';
import { SandboxedReplayDto } from './dto/sandboxed-replay.dto';
import { SandboxedReplayService } from './sandboxed-replay.service';

@Controller('api/v1/experiments')
export class ExperimentController {
  constructor(
    @Inject(ExperimentService) private readonly service: ExperimentService,
    @Inject(SandboxedReplayService) private readonly sandboxedReplayService: SandboxedReplayService
  ) {}

  @Post('sandboxed-replay')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR)
  @RequirePermissions('experiments:write')
  @Audit('RUN_SANDBOXED_REPLAY')
  executeSandboxedReplay(@Body() dto: SandboxedReplayDto) { return this.sandboxedReplayService.executeSandboxedReplay(dto); }

  @Post('scenarios')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR)
  @RequirePermissions('experiments:write')
  @Audit('CREATE_EXPERIMENT_SCENARIO')
  createScenario(@Body() dto: CreateScenarioDto) { return this.service.createScenario(dto); }

  @Get('scenarios')
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR, Role.AUDITOR)
  @RequirePermissions('experiments:read')
  @Audit('LIST_EXPERIMENT_SCENARIOS')
  listScenarios() { return this.service.listScenarios(); }

  @Post('scenarios/:id/runs')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR)
  @RequirePermissions('experiments:write')
  @Audit('RUN_EXPERIMENT')
  runScenario(@Param('id') id: string, @Body() dto: RunExperimentDto) { return this.service.runScenario(id, dto); }

  @Post('runs/:id/replay')
  @HttpCode(201)
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR)
  @RequirePermissions('experiments:write')
  @Audit('REPLAY_EXPERIMENT_RUN')
  async replayRun(@Param('id') id: string) {
    const run = await this.service.getRun(id);
    return this.service.runScenario(run.data!.scenarioId, { mode: run.data!.mode, replayOfRunId: run.data!.id });
  }

  @Get('runs/:id')
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR, Role.AUDITOR)
  @RequirePermissions('experiments:read')
  @Audit('GET_EXPERIMENT_RUN')
  getRun(@Param('id') id: string) { return this.service.getRun(id); }

  @Get('compare')
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR, Role.AUDITOR)
  @RequirePermissions('experiments:read')
  @Audit('COMPARE_EXPERIMENT_RUNS')
  compareRuns(@Query('baselineRunId') baselineRunId: string, @Query('candidateRunId') candidateRunId: string) { return this.service.compareRuns(baselineRunId, candidateRunId); }
}
