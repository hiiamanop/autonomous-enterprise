import type { ScenarioDefinition } from '@autonomous-enterprise/contracts';

export class CreateScenarioDto {
  name!: string;
  description?: string;
  scenarioType!: string;
  definition!: ScenarioDefinition;
}
