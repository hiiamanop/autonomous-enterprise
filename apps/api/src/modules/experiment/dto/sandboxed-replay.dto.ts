import type { ExperimentMode, ScenarioDefinition } from '@autonomous-enterprise/contracts';

export class SandboxedReplayDto {
  sourceWorkflowId?: string;
  scenarioId?: string;
  scenarioDefinition?: ScenarioDefinition;
  mode!: ExperimentMode;
  configurationId?: string;
  budgetUsd?: number;
  model?: string;
  agentVersions?: Record<string, string>;
  modelVersions?: Record<string, string>;
}
