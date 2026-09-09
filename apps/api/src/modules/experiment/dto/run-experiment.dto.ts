import type { ExperimentMode } from '@autonomous-enterprise/contracts';

export class RunExperimentDto {
  mode!: ExperimentMode;
  replayOfRunId?: string;
  configurationId?: string;
  budgetUsd?: number;
  model?: string;
  agentVersions?: Record<string, string>;
  modelVersions?: Record<string, string>;
}
