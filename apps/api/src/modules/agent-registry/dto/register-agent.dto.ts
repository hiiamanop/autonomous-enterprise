import type { AgentAvailability } from '@autonomous-enterprise/contracts';

export class RegisterAgentDto {
  agentName!: string;
  version!: string;
  model!: string;
  capabilities!: string[];
  costPerCall?: number;
  availability?: AgentAvailability;
}
