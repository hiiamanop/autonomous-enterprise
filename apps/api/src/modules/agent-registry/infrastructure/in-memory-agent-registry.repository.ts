import { Injectable } from '@nestjs/common';
import type { AgentRegistration, TrustProfile } from '../domain/agent-registry.types';
import type { IAgentRegistryRepository } from '../domain/agent-registry.repository.interface';

@Injectable()
export class InMemoryAgentRegistryRepository implements IAgentRegistryRepository {
  private readonly agents: Map<string, AgentRegistration> = new Map();
  private readonly trustProfiles: Map<string, TrustProfile> = new Map();

  private cloneTrustProfile(tp: TrustProfile): TrustProfile {
    return { ...tp };
  }

  private cloneAgent(agent: AgentRegistration): AgentRegistration {
    return {
      ...agent,
      capabilities: [...agent.capabilities],
      trustProfile: agent.trustProfile ? this.cloneTrustProfile(agent.trustProfile) : undefined
    };
  }

  async upsertAgent(
    agent: AgentRegistration,
    initialTrustProfile?: TrustProfile
  ): Promise<AgentRegistration> {
    for (const [key, existing] of this.agents.entries()) {
      if (existing.agentName === agent.agentName) {
        const tp = this.getTrustProfileForAgent(existing.id);
        const updated: AgentRegistration = {
          ...existing,
          version: agent.version,
          model: agent.model,
          capabilities: [...agent.capabilities],
          availability: agent.availability ?? existing.availability,
          costPerCall: agent.costPerCall !== undefined ? agent.costPerCall : existing.costPerCall,
          updatedAt: agent.updatedAt || new Date().toISOString(),
          trustProfile: tp ? this.cloneTrustProfile(tp) : existing.trustProfile
        };
        this.agents.set(key, updated);
        return this.cloneAgent(updated);
      }
    }

    this.agents.set(agent.id, this.cloneAgent(agent));
    if (initialTrustProfile) {
      this.trustProfiles.set(initialTrustProfile.agentRegistrationId, this.cloneTrustProfile(initialTrustProfile));
      const registered = this.agents.get(agent.id)!;
      registered.trustProfile = this.cloneTrustProfile(initialTrustProfile);
      return this.cloneAgent(registered);
    }
    return this.cloneAgent(agent);
  }

  private getTrustProfileForAgent(agentRegistrationId: string): TrustProfile | null {
    const tp = this.trustProfiles.get(agentRegistrationId);
    return tp ? this.cloneTrustProfile(tp) : null;
  }

  async findAgentByName(agentName: string): Promise<AgentRegistration | null> {
    for (const agent of this.agents.values()) {
      if (agent.agentName === agentName) {
        const tp = this.getTrustProfileForAgent(agent.id);
        const result: AgentRegistration = {
          ...agent,
          capabilities: [...agent.capabilities],
          trustProfile: tp ? this.cloneTrustProfile(tp) : agent.trustProfile
        };
        return this.cloneAgent(result);
      }
    }
    return null;
  }

  async findAgentById(id: string): Promise<AgentRegistration | null> {
    const agent = this.agents.get(id);
    if (!agent) {
      return null;
    }
    const tp = this.getTrustProfileForAgent(agent.id);
    const result: AgentRegistration = {
      ...agent,
      capabilities: [...agent.capabilities],
      trustProfile: tp ? this.cloneTrustProfile(tp) : agent.trustProfile
    };
    return this.cloneAgent(result);
  }

  async findAllAgents(): Promise<AgentRegistration[]> {
    const result: AgentRegistration[] = [];
    for (const agent of this.agents.values()) {
      const tp = this.getTrustProfileForAgent(agent.id);
      result.push(
        this.cloneAgent({
          ...agent,
          trustProfile: tp ? this.cloneTrustProfile(tp) : agent.trustProfile
        })
      );
    }
    return result;
  }

  async updateAgent(agent: AgentRegistration): Promise<AgentRegistration> {
    this.agents.set(agent.id, this.cloneAgent(agent));
    return this.cloneAgent(agent);
  }

  async createTrustProfile(trustProfile: TrustProfile): Promise<TrustProfile> {
    this.trustProfiles.set(trustProfile.agentRegistrationId, this.cloneTrustProfile(trustProfile));
    return this.cloneTrustProfile(trustProfile);
  }

  async findTrustProfileByAgentId(
    agentRegistrationId: string
  ): Promise<TrustProfile | null> {
    return this.getTrustProfileForAgent(agentRegistrationId);
  }

  async updateTrustProfile(trustProfile: TrustProfile): Promise<TrustProfile> {
    this.trustProfiles.set(trustProfile.agentRegistrationId, this.cloneTrustProfile(trustProfile));
    return this.cloneTrustProfile(trustProfile);
  }
}
