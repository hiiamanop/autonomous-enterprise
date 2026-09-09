import { Injectable } from '@nestjs/common';
import type { ExperimentRun, ExperimentScenario } from '@autonomous-enterprise/contracts';
import type { IExperimentRepository } from '../domain/experiment.repository.interface';

@Injectable()
export class InMemoryExperimentRepository implements IExperimentRepository {
  private readonly scenarios: Map<string, ExperimentScenario> = new Map();
  private readonly runs: Map<string, ExperimentRun> = new Map();

  async createScenario(scenario: ExperimentScenario): Promise<ExperimentScenario> {
    this.scenarios.set(scenario.id, { ...scenario });
    return { ...scenario };
  }

  async findScenarioById(id: string): Promise<ExperimentScenario | null> {
    const s = this.scenarios.get(id);
    return s ? { ...s } : null;
  }

  async findAllScenarios(): Promise<ExperimentScenario[]> {
    return Array.from(this.scenarios.values()).map((s) => ({ ...s }));
  }

  async createRun(run: ExperimentRun): Promise<ExperimentRun> {
    this.runs.set(run.id, { ...run });
    return { ...run };
  }

  async updateRun(run: ExperimentRun): Promise<ExperimentRun> {
    if (!this.runs.has(run.id)) {
      throw new Error(`ExperimentRun with ID ${run.id} not found`);
    }
    this.runs.set(run.id, { ...run });
    return { ...run };
  }

  async findRunById(id: string): Promise<ExperimentRun | null> {
    const r = this.runs.get(id);
    return r ? { ...r } : null;
  }

  async findRunsByScenario(scenarioId: string): Promise<ExperimentRun[]> {
    return Array.from(this.runs.values())
      .filter((r) => r.scenarioId === scenarioId)
      .map((r) => ({ ...r }));
  }
}
