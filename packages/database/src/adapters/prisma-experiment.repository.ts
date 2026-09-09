import type {
  ExperimentMode as PrismaExperimentMode,
  ExperimentRun as PrismaExperimentRun,
  ExperimentScenario as PrismaExperimentScenario,
  ExperimentStatus as PrismaExperimentStatus,
  PrismaClient,
  Prisma
} from '@prisma/client';

export type ExperimentModeEnum = 'DETERMINISTIC' | 'SINGLE_AGENT' | 'MULTI_AGENT' | 'ORCHESTRATED' | 'PROPOSED';
export type ExperimentStatusEnum = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface ScenarioEntity {
  id: string;
  name: string;
  description?: string;
  scenarioType: string;
  definition: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentRunEntity {
  id: string;
  scenarioId: string;
  replayOfRunId?: string;
  mode: ExperimentModeEnum;
  status: ExperimentStatusEnum;
  configurationId?: string;
  agentVersions?: Record<string, string>;
  modelVersions?: Record<string, string>;
  policyVersion?: string;
  budgetUsd?: number;
  finalResult?: Record<string, unknown>;
  result?: unknown;
  success?: boolean;
  durationMs?: number;
  latencyMs?: number;
  tokenCount?: number;
  tokensUsed?: number;
  aiCostUsd?: number;
  costUsd?: number;
  accuracyScore?: number;
  llmCallCount?: number;
  conflictCount?: number;
  escalationCount?: number;
  reevaluationCount?: number;
  errorMessage?: string;
  error?: string;
  startedAt?: string;
  executedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IExperimentRepository {
  createScenario(scenario: ScenarioEntity): Promise<ScenarioEntity>;
  findScenarioById(id: string): Promise<ScenarioEntity | null>;
  findAllScenarios(): Promise<ScenarioEntity[]>;
  createRun(run: ExperimentRunEntity): Promise<ExperimentRunEntity>;
  updateRun(run: ExperimentRunEntity): Promise<ExperimentRunEntity>;
  findRunById(id: string): Promise<ExperimentRunEntity | null>;
  findRunsByScenario(scenarioId: string): Promise<ExperimentRunEntity[]>;
  findAllRuns(): Promise<ExperimentRunEntity[]>;
}

export class PrismaExperimentRepository implements IExperimentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapScenario(raw: PrismaExperimentScenario): ScenarioEntity {
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description ?? undefined,
      scenarioType: raw.scenarioType,
      definition: (raw.definition as Record<string, unknown>) ?? {},
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapRun(raw: PrismaExperimentRun): ExperimentRunEntity {
    return {
      id: raw.id,
      scenarioId: raw.scenarioId,
      mode: raw.mode as ExperimentModeEnum,
      status: raw.status as ExperimentStatusEnum,
      latencyMs: raw.latencyMs ?? undefined,
      durationMs: raw.latencyMs ?? undefined,
      tokensUsed: raw.tokensUsed ?? undefined,
      tokenCount: raw.tokensUsed ?? 0,
      costUsd: raw.costUsd ?? undefined,
      aiCostUsd: raw.costUsd ?? 0,
      accuracyScore: raw.accuracyScore ?? undefined,
      result: raw.result ?? undefined,
      finalResult: (raw.result as Record<string, unknown>) ?? undefined,
      error: raw.error ?? undefined,
      errorMessage: raw.error ?? undefined,
      executedAt: raw.executedAt ? raw.executedAt.toISOString() : undefined,
      startedAt: raw.executedAt ? raw.executedAt.toISOString() : undefined,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  async createScenario(scenario: ScenarioEntity): Promise<ScenarioEntity> {
    const raw = await this.prisma.experimentScenario.create({
      data: {
        id: scenario.id,
        name: scenario.name,
        description: scenario.description,
        scenarioType: scenario.scenarioType,
        definition: scenario.definition as Prisma.InputJsonValue,
        createdAt: new Date(scenario.createdAt),
        updatedAt: new Date(scenario.updatedAt)
      }
    });

    return this.mapScenario(raw);
  }

  async findScenarioById(id: string): Promise<ScenarioEntity | null> {
    const raw = await this.prisma.experimentScenario.findUnique({
      where: { id }
    });

    return raw ? this.mapScenario(raw) : null;
  }

  async findAllScenarios(): Promise<ScenarioEntity[]> {
    const rawList = await this.prisma.experimentScenario.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return rawList.map((item) => this.mapScenario(item));
  }

  async createRun(run: ExperimentRunEntity): Promise<ExperimentRunEntity> {
    const raw = await this.prisma.experimentRun.create({
      data: {
        id: run.id,
        scenarioId: run.scenarioId,
        mode: run.mode as PrismaExperimentMode,
        status: run.status as PrismaExperimentStatus,
        latencyMs: run.latencyMs ?? run.durationMs,
        tokensUsed: run.tokensUsed ?? run.tokenCount,
        costUsd: run.costUsd ?? run.aiCostUsd,
        accuracyScore: run.accuracyScore,
        result: (run.result ?? run.finalResult ?? undefined) as Prisma.InputJsonValue,
        error: run.error ?? run.errorMessage,
        executedAt: run.executedAt || run.startedAt ? new Date(run.executedAt || run.startedAt!) : undefined,
        createdAt: new Date(run.createdAt),
        updatedAt: new Date(run.updatedAt)
      }
    });

    return this.mapRun(raw);
  }

  async updateRun(run: ExperimentRunEntity): Promise<ExperimentRunEntity> {
    const raw = await this.prisma.experimentRun.update({
      where: { id: run.id },
      data: {
        status: run.status as PrismaExperimentStatus,
        latencyMs: run.latencyMs ?? run.durationMs,
        tokensUsed: run.tokensUsed ?? run.tokenCount,
        costUsd: run.costUsd ?? run.aiCostUsd,
        accuracyScore: run.accuracyScore,
        result: (run.result ?? run.finalResult ?? undefined) as Prisma.InputJsonValue,
        error: run.error ?? run.errorMessage,
        executedAt: run.executedAt || run.startedAt ? new Date(run.executedAt || run.startedAt!) : undefined,
        updatedAt: new Date()
      }
    });

    return this.mapRun(raw);
  }

  async findRunById(id: string): Promise<ExperimentRunEntity | null> {
    const raw = await this.prisma.experimentRun.findUnique({
      where: { id }
    });

    return raw ? this.mapRun(raw) : null;
  }

  async findRunsByScenario(scenarioId: string): Promise<ExperimentRunEntity[]> {
    const rawList = await this.prisma.experimentRun.findMany({
      where: { scenarioId },
      orderBy: { createdAt: 'desc' }
    });

    return rawList.map((item) => this.mapRun(item));
  }

  async findAllRuns(): Promise<ExperimentRunEntity[]> {
    const rawList = await this.prisma.experimentRun.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return rawList.map((item) => this.mapRun(item));
  }
}
