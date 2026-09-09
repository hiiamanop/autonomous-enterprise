import type { ExperimentRun, ExperimentScenario } from '@autonomous-enterprise/contracts';

export interface IExperimentRepository {
  createScenario(scenario: ExperimentScenario): Promise<ExperimentScenario>;
  findScenarioById(id: string): Promise<ExperimentScenario | null>;
  findAllScenarios(): Promise<ExperimentScenario[]>;
  createRun(run: ExperimentRun): Promise<ExperimentRun>;
  updateRun(run: ExperimentRun): Promise<ExperimentRun>;
  findRunById(id: string): Promise<ExperimentRun | null>;
  findRunsByScenario(scenarioId: string): Promise<ExperimentRun[]>;
}

export const EXPERIMENT_REPOSITORY = 'EXPERIMENT_REPOSITORY';
