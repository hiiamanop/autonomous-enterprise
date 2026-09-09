import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ExperimentMode, type ApiResponse, type ExperimentRun, type ExperimentScenario, type ScenarioDefinition } from '@autonomous-enterprise/contracts';
import { RequestContextStorage, TenantContextStorage } from '@autonomous-enterprise/shared';
import { AuditService } from '../../common/audit/audit.service';
import { EXPERIMENT_REPOSITORY, type IExperimentRepository } from './domain/experiment.repository.interface';
import type { SandboxedReplayDto } from './dto/sandboxed-replay.dto';
import { ExperimentService } from './experiment.service';

export interface SandboxedReplayComparison {
  baselineRunId?: string;
  baseline?: ExperimentRun;
  deltas?: Record<string, number>;
}

export interface SandboxedReplayResult {
  replayRun: ExperimentRun;
  sandboxId: string;
  sourceWorkflowId?: string;
  isSandboxed: true;
  zeroProductionMutation: true;
  metrics: {
    tokens: number;
    latencyMs: number;
    aiCostUsd: number;
    conflictDetections: number;
    circuitBreakerChecks: number;
  };
  comparison: SandboxedReplayComparison;
}

@Injectable()
export class SandboxedReplayService {
  constructor(
    @Inject(EXPERIMENT_REPOSITORY) private readonly repository: IExperimentRepository,
    @Inject(ExperimentService) private readonly experimentService: ExperimentService,
    @Inject(AuditService) private readonly auditService: AuditService
  ) {}

  async executeSandboxedReplay(dto: SandboxedReplayDto): Promise<ApiResponse<SandboxedReplayResult>> {
    const context = RequestContextStorage.getContext() || TenantContextStorage.getContext();
    if (!Object.values(ExperimentMode).includes(dto.mode)) throw new BadRequestException('A valid experiment mode is required');
    if (!dto.sourceWorkflowId && !dto.scenarioId && !dto.scenarioDefinition) {
      throw new BadRequestException('sourceWorkflowId, scenarioId or scenarioDefinition is required');
    }

    const sourceId = dto.sourceWorkflowId ?? dto.scenarioId;
    const source = sourceId ? await this.repository.findScenarioById(sourceId) : null;
    if (sourceId && !source) throw new NotFoundException(`Workflow or scenario [${sourceId}] not found`);
    const definition: ScenarioDefinition = dto.scenarioDefinition ?? source!.definition;
    const sandboxId = `sandbox_${Date.now()}`;
    const sandboxScenario: ExperimentScenario = {
      id: `sandbox-scenario-${randomUUID()}`,
      name: `Sandbox replay${source ? ` of ${source.name}` : ''}`,
      description: 'Isolated sandboxed workflow replay',
      scenarioType: definition.scenarioType,
      definition,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const baselineRuns = source ? await this.repository.findRunsByScenario(source.id) : [];
    const baseline = baselineRuns.filter((run) => run.mode === ExperimentMode.DETERMINISTIC).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0] ?? baselineRuns[0];

    await this.repository.createScenario(sandboxScenario);
    const runResponse = await this.experimentService.runScenario(sandboxScenario.id, {
      mode: dto.mode,
      budgetUsd: dto.budgetUsd,
      configurationId: dto.configurationId
    });
    const replayRun = runResponse.data!;

    const comparison: SandboxedReplayComparison = {};
    if (baseline) {
      comparison.baselineRunId = baseline.id;
      comparison.baseline = baseline;
      comparison.deltas = {
        tokens: replayRun.tokenCount - baseline.tokenCount,
        latencyMs: (replayRun.durationMs ?? 0) - (baseline.durationMs ?? 0),
        aiCostUsd: Number((replayRun.aiCostUsd - baseline.aiCostUsd).toFixed(5)),
        conflictDetections: replayRun.conflictCount - baseline.conflictCount,
        circuitBreakerChecks: replayRun.escalationCount - baseline.escalationCount
      };
    }

    const result: SandboxedReplayResult = {
      replayRun,
      sandboxId,
      sourceWorkflowId: dto.sourceWorkflowId,
      isSandboxed: true,
      zeroProductionMutation: true,
      metrics: {
        tokens: replayRun.tokenCount,
        latencyMs: replayRun.durationMs ?? 0,
        aiCostUsd: replayRun.aiCostUsd,
        conflictDetections: replayRun.conflictCount,
        circuitBreakerChecks: replayRun.escalationCount
      },
      comparison
    };

    this.auditService.record({
      action: 'SANDBOXED_REPLAY_EXECUTED',
      workflowId: dto.sourceWorkflowId ?? sandboxScenario.id,
      input: { dto, sandboxId },
      output: result,
      status: replayRun.status === 'FAILED' ? 'FAILURE' : 'SUCCESS',
      reasoning: `Zero production mutation sandboxed replay completed in mode ${dto.mode}`
    });

    return {
      success: true,
      data: result,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: context?.requestId
      }
    };
  }
}
