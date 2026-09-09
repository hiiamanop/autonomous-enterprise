import type {
  PrismaClient,
  AgentRegistration as PrismaAgentRegistration,
  TrustProfile as PrismaTrustProfile,
  AgentAvailability as PrismaAgentAvailability
} from '@prisma/client';
import { AgentAvailability } from '@autonomous-enterprise/contracts';

export interface TrustProfileEntity {
  id: string;
  agentRegistrationId: string;
  accuracy: number;
  consistency: number;
  calibration: number;
  historicalSuccessRate: number;
  failureRate: number;
  policyViolations: number;
  overallTrust: number;
  sampleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRegistrationEntity {
  id: string;
  agentName: string;
  version: string;
  model: string;
  capabilities: string[];
  availability: AgentAvailability;
  costPerCall: number;
  trustProfile?: TrustProfileEntity;
  createdAt: string;
  updatedAt: string;
}

export interface IAgentRegistryRepository {
  upsertAgent(
    agent: AgentRegistrationEntity,
    initialTrustProfile?: TrustProfileEntity
  ): Promise<AgentRegistrationEntity>;
  findAgentByName(agentName: string): Promise<AgentRegistrationEntity | null>;
  findAgentById(id: string): Promise<AgentRegistrationEntity | null>;
  findAllAgents(): Promise<AgentRegistrationEntity[]>;
  updateAgent(agent: AgentRegistrationEntity): Promise<AgentRegistrationEntity>;
  createTrustProfile(trustProfile: TrustProfileEntity): Promise<TrustProfileEntity>;
  findTrustProfileByAgentId(
    agentRegistrationId: string
  ): Promise<TrustProfileEntity | null>;
  updateTrustProfile(trustProfile: TrustProfileEntity): Promise<TrustProfileEntity>;
}

export class PrismaAgentRegistryRepository implements IAgentRegistryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapAgent(
    raw: PrismaAgentRegistration & { trustProfile?: PrismaTrustProfile | null }
  ): AgentRegistrationEntity {
    return {
      id: raw.id,
      agentName: raw.agentName,
      version: raw.version,
      model: raw.model,
      capabilities: raw.capabilities,
      availability: raw.availability as AgentAvailability,
      costPerCall: raw.costPerCall,
      trustProfile: raw.trustProfile ? this.mapTrustProfile(raw.trustProfile) : undefined,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  private mapTrustProfile(raw: PrismaTrustProfile): TrustProfileEntity {
    return {
      id: raw.id,
      agentRegistrationId: raw.agentRegistrationId,
      accuracy: raw.accuracy,
      consistency: raw.consistency,
      calibration: raw.calibration,
      historicalSuccessRate: raw.historicalSuccessRate,
      failureRate: raw.failureRate,
      policyViolations: raw.policyViolations,
      overallTrust: raw.overallTrust,
      sampleCount: raw.sampleCount,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  async upsertAgent(
    agent: AgentRegistrationEntity,
    initialTrustProfile?: TrustProfileEntity
  ): Promise<AgentRegistrationEntity> {
    const raw = await this.prisma.agentRegistration.upsert({
      where: {
        agentName: agent.agentName
      },
      update: {
        version: agent.version,
        model: agent.model,
        capabilities: agent.capabilities,
        availability: agent.availability as PrismaAgentAvailability,
        costPerCall: agent.costPerCall,
        updatedAt: new Date(agent.updatedAt)
      },
      create: {
        id: agent.id,
        agentName: agent.agentName,
        version: agent.version,
        model: agent.model,
        capabilities: agent.capabilities,
        availability: agent.availability as PrismaAgentAvailability,
        costPerCall: agent.costPerCall,
        createdAt: new Date(agent.createdAt),
        updatedAt: new Date(agent.updatedAt),
        trustProfile: initialTrustProfile
          ? {
              create: {
                id: initialTrustProfile.id,
                accuracy: initialTrustProfile.accuracy,
                consistency: initialTrustProfile.consistency,
                calibration: initialTrustProfile.calibration,
                historicalSuccessRate: initialTrustProfile.historicalSuccessRate,
                failureRate: initialTrustProfile.failureRate,
                policyViolations: initialTrustProfile.policyViolations,
                overallTrust: initialTrustProfile.overallTrust,
                sampleCount: initialTrustProfile.sampleCount,
                createdAt: new Date(initialTrustProfile.createdAt),
                updatedAt: new Date(initialTrustProfile.updatedAt)
              }
            }
          : undefined
      },
      include: {
        trustProfile: true
      }
    });

    return this.mapAgent(raw);
  }

  async findAgentByName(agentName: string): Promise<AgentRegistrationEntity | null> {
    const raw = await this.prisma.agentRegistration.findUnique({
      where: {
        agentName
      },
      include: {
        trustProfile: true
      }
    });

    return raw ? this.mapAgent(raw) : null;
  }

  async findAgentById(id: string): Promise<AgentRegistrationEntity | null> {
    const raw = await this.prisma.agentRegistration.findUnique({
      where: { id },
      include: {
        trustProfile: true
      }
    });

    return raw ? this.mapAgent(raw) : null;
  }

  async findAllAgents(): Promise<AgentRegistrationEntity[]> {
    const rawList = await this.prisma.agentRegistration.findMany({
      include: {
        trustProfile: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return rawList.map((item) => this.mapAgent(item));
  }

  async updateAgent(agent: AgentRegistrationEntity): Promise<AgentRegistrationEntity> {
    const raw = await this.prisma.agentRegistration.update({
      where: { id: agent.id },
      data: {
        version: agent.version,
        model: agent.model,
        capabilities: agent.capabilities,
        availability: agent.availability as PrismaAgentAvailability,
        costPerCall: agent.costPerCall,
        updatedAt: new Date()
      },
      include: {
        trustProfile: true
      }
    });

    return this.mapAgent(raw);
  }

  async createTrustProfile(trustProfile: TrustProfileEntity): Promise<TrustProfileEntity> {
    const raw = await this.prisma.trustProfile.create({
      data: {
        id: trustProfile.id,
        agentRegistrationId: trustProfile.agentRegistrationId,
        accuracy: trustProfile.accuracy,
        consistency: trustProfile.consistency,
        calibration: trustProfile.calibration,
        historicalSuccessRate: trustProfile.historicalSuccessRate,
        failureRate: trustProfile.failureRate,
        policyViolations: trustProfile.policyViolations,
        overallTrust: trustProfile.overallTrust,
        sampleCount: trustProfile.sampleCount,
        createdAt: new Date(trustProfile.createdAt),
        updatedAt: new Date(trustProfile.updatedAt)
      }
    });

    return this.mapTrustProfile(raw);
  }

  async findTrustProfileByAgentId(
    agentRegistrationId: string
  ): Promise<TrustProfileEntity | null> {
    const raw = await this.prisma.trustProfile.findUnique({
      where: {
        agentRegistrationId
      }
    });

    return raw ? this.mapTrustProfile(raw) : null;
  }

  async updateTrustProfile(trustProfile: TrustProfileEntity): Promise<TrustProfileEntity> {
    const raw = await this.prisma.trustProfile.update({
      where: { id: trustProfile.id },
      data: {
        accuracy: trustProfile.accuracy,
        consistency: trustProfile.consistency,
        calibration: trustProfile.calibration,
        historicalSuccessRate: trustProfile.historicalSuccessRate,
        failureRate: trustProfile.failureRate,
        policyViolations: trustProfile.policyViolations,
        overallTrust: trustProfile.overallTrust,
        sampleCount: trustProfile.sampleCount,
        updatedAt: new Date()
      }
    });

    return this.mapTrustProfile(raw);
  }
}
