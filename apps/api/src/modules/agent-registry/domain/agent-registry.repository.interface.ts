import type { AgentRegistration, TrustProfile } from './agent-registry.types';

export interface IAgentRegistryRepository {
  upsertAgent(
    agent: AgentRegistration,
    initialTrustProfile?: TrustProfile
  ): Promise<AgentRegistration>;
  findAgentByName(agentName: string): Promise<AgentRegistration | null>;
  findAgentById(id: string): Promise<AgentRegistration | null>;
  findAllAgents(): Promise<AgentRegistration[]>;
  updateAgent(agent: AgentRegistration): Promise<AgentRegistration>;
  createTrustProfile(trustProfile: TrustProfile): Promise<TrustProfile>;
  findTrustProfileByAgentId(
    agentRegistrationId: string
  ): Promise<TrustProfile | null>;
  updateTrustProfile(trustProfile: TrustProfile): Promise<TrustProfile>;
}

export const AGENT_REGISTRY_REPOSITORY = 'AGENT_REGISTRY_REPOSITORY';
