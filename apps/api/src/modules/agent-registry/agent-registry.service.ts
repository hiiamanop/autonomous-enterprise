import {
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { ApiResponse } from '@autonomous-enterprise/contracts';
import { AgentAvailability } from '@autonomous-enterprise/contracts';
import { RequestContextStorage, TenantContextStorage } from '@autonomous-enterprise/shared';
import type {
  AgentRegistration,
  TrustProfile,
  TrustOutcome
} from './domain/agent-registry.types';
import {
  AGENT_REGISTRY_REPOSITORY,
  type IAgentRegistryRepository
} from './domain/agent-registry.repository.interface';
import type { RegisterAgentDto } from './dto/register-agent.dto';
import type { UpdateTrustProfileDto } from './dto/update-trust-profile.dto';

@Injectable()
export class AgentRegistryService {
  constructor(
    @Inject(AGENT_REGISTRY_REPOSITORY)
    private readonly repository: IAgentRegistryRepository
  ) {}

  private buildMetadata() {
    const context = RequestContextStorage.getContext() || TenantContextStorage.getContext();
    return {
      timestamp: new Date().toISOString(),
      requestId: context?.requestId
    };
  }

  async registerAgent(dto: RegisterAgentDto): Promise<ApiResponse<AgentRegistration>> {
    const existing = await this.repository.findAgentByName(dto.agentName);
    const now = new Date().toISOString();

    if (existing) {
      const updated: AgentRegistration = {
        ...existing,
        version: dto.version ?? existing.version,
        model: dto.model ?? existing.model,
        capabilities: dto.capabilities ?? existing.capabilities,
        availability: dto.availability ?? existing.availability,
        costPerCall: dto.costPerCall !== undefined ? dto.costPerCall : existing.costPerCall,
        updatedAt: now
      };
      const saved = await this.repository.updateAgent(updated);
      return {
        success: true,
        data: saved,
        metadata: this.buildMetadata()
      };
    }

    const agentId = randomUUID();
    const trustProfileId = randomUUID();

    const initialTrust: TrustProfile = {
      id: trustProfileId,
      agentRegistrationId: agentId,
      accuracy: 0.5,
      consistency: 0.5,
      calibration: 0.5,
      historicalSuccessRate: 0.5,
      failureRate: 0.0,
      policyViolations: 0,
      overallTrust: 0.5,
      sampleCount: 0,
      createdAt: now,
      updatedAt: now
    };

    const newAgent: AgentRegistration = {
      id: agentId,
      agentName: dto.agentName,
      version: dto.version,
      model: dto.model,
      capabilities: dto.capabilities || [],
      availability: dto.availability ?? AgentAvailability.AVAILABLE,
      costPerCall: dto.costPerCall ?? 0.0,
      trustProfile: initialTrust,
      createdAt: now,
      updatedAt: now
    };

    const saved = await this.repository.upsertAgent(newAgent, initialTrust);
    return {
      success: true,
      data: saved,
      metadata: this.buildMetadata()
    };
  }

  async getAgent(agentName: string): Promise<ApiResponse<AgentRegistration>> {
    const agent = await this.repository.findAgentByName(agentName);
    if (!agent) {
      throw new NotFoundException(`Agent '${agentName}' not found`);
    }

    return {
      success: true,
      data: agent,
      metadata: this.buildMetadata()
    };
  }

  async listAgents(): Promise<ApiResponse<AgentRegistration[]>> {
    const agents = await this.repository.findAllAgents();

    return {
      success: true,
      data: agents,
      metadata: this.buildMetadata()
    };
  }

  async updateAvailability(
    agentName: string,
    availability: AgentAvailability
  ): Promise<ApiResponse<AgentRegistration>> {
    const agent = await this.repository.findAgentByName(agentName);
    if (!agent) {
      throw new NotFoundException(`Agent '${agentName}' not found`);
    }

    agent.availability = availability;
    agent.updatedAt = new Date().toISOString();

    const updated = await this.repository.updateAgent(agent);
    return {
      success: true,
      data: updated,
      metadata: this.buildMetadata()
    };
  }

  async recordTrustOutcome(
    agentName: string,
    outcome: TrustOutcome
  ): Promise<ApiResponse<AgentRegistration>> {
    let agent = await this.repository.findAgentByName(agentName);
    const now = new Date().toISOString();

    if (!agent) {
      const autoAgentId = randomUUID();
      const autoTrustId = randomUUID();

      const initialTrust: TrustProfile = {
        id: autoTrustId,
        agentRegistrationId: autoAgentId,
        accuracy: 0.5,
        consistency: 0.5,
        calibration: 0.5,
        historicalSuccessRate: 0.5,
        failureRate: 0.0,
        policyViolations: 0,
        overallTrust: 0.5,
        sampleCount: 0,
        createdAt: now,
        updatedAt: now
      };

      const autoAgent: AgentRegistration = {
        id: autoAgentId,
        agentName,
        version: '0.0.0',
        model: 'unknown',
        capabilities: [],
        availability: AgentAvailability.AVAILABLE,
        costPerCall: 0.0,
        trustProfile: initialTrust,
        createdAt: now,
        updatedAt: now
      };

      agent = await this.repository.upsertAgent(autoAgent, initialTrust);
    }

    let trustProfile = agent.trustProfile;
    if (!trustProfile) {
      const fetchedTp = await this.repository.findTrustProfileByAgentId(agent.id);
      if (fetchedTp) {
        trustProfile = fetchedTp;
      } else {
        trustProfile = {
          id: randomUUID(),
          agentRegistrationId: agent.id,
          accuracy: 0.5,
          consistency: 0.5,
          calibration: 0.5,
          historicalSuccessRate: 0.5,
          failureRate: 0.0,
          policyViolations: 0,
          overallTrust: 0.5,
          sampleCount: 0,
          createdAt: now,
          updatedAt: now
        };
        await this.repository.createTrustProfile(trustProfile);
      }
    }

    const alpha = 0.2;
    const targetSuccess = outcome.success ? 1.0 : 0.0;
    const targetFailure = outcome.success ? 0.0 : 1.0;

    const newAccuracy = trustProfile.accuracy * (1 - alpha) + targetSuccess * alpha;
    const newHistoricalSuccessRate =
      trustProfile.historicalSuccessRate * (1 - alpha) + targetSuccess * alpha;
    const newFailureRate = trustProfile.failureRate * (1 - alpha) + targetFailure * alpha;

    const calibrationScore = 1.0 - Math.abs(outcome.confidence - targetSuccess);
    const newCalibration = trustProfile.calibration * (1 - alpha) + calibrationScore * alpha;

    const consistencyScore = outcome.success
      ? outcome.confidence >= 0.5 ? 1.0 : 0.7
      : outcome.confidence <= 0.5 ? 0.7 : 0.2;
    const newConsistency = trustProfile.consistency * (1 - alpha) + consistencyScore * alpha;

    const newPolicyViolations = trustProfile.policyViolations + (outcome.policyViolation ? 1 : 0);
    const newSampleCount = trustProfile.sampleCount + 1;

    const weightedScore =
      newAccuracy * 0.3 +
      newConsistency * 0.2 +
      newCalibration * 0.2 +
      newHistoricalSuccessRate * 0.3;
    const penalty = newPolicyViolations * 0.05;
    const newOverallTrust = Math.max(0, Math.min(1, weightedScore - penalty));

    const updatedProfile: TrustProfile = {
      ...trustProfile,
      accuracy: Number(newAccuracy.toFixed(4)),
      consistency: Number(newConsistency.toFixed(4)),
      calibration: Number(newCalibration.toFixed(4)),
      historicalSuccessRate: Number(newHistoricalSuccessRate.toFixed(4)),
      failureRate: Number(newFailureRate.toFixed(4)),
      policyViolations: newPolicyViolations,
      overallTrust: Number(newOverallTrust.toFixed(4)),
      sampleCount: newSampleCount,
      updatedAt: now
    };

    const savedProfile = await this.repository.updateTrustProfile(updatedProfile);
    const updatedAgent = await this.repository.findAgentByName(agentName);

    return {
      success: true,
      data: updatedAgent ?? {
        ...agent,
        trustProfile: savedProfile
      },
      metadata: this.buildMetadata()
    };
  }

  async updateTrustProfile(
    agentName: string,
    dto: UpdateTrustProfileDto
  ): Promise<ApiResponse<AgentRegistration>> {
    const agent = await this.repository.findAgentByName(agentName);
    if (!agent) {
      throw new NotFoundException(`Agent '${agentName}' not found`);
    }

    let trustProfile = agent.trustProfile;
    if (!trustProfile) {
      const fetched = await this.repository.findTrustProfileByAgentId(agent.id);
      if (fetched) {
        trustProfile = fetched;
      } else {
        trustProfile = {
          id: randomUUID(),
          agentRegistrationId: agent.id,
          accuracy: 0.5,
          consistency: 0.5,
          calibration: 0.5,
          historicalSuccessRate: 0.5,
          failureRate: 0.0,
          policyViolations: 0,
          overallTrust: 0.5,
          sampleCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await this.repository.createTrustProfile(trustProfile);
      }
    }

    const accuracy = dto.accuracy !== undefined ? dto.accuracy : trustProfile.accuracy;
    const consistency = dto.consistency !== undefined ? dto.consistency : trustProfile.consistency;
    const calibration = dto.calibration !== undefined ? dto.calibration : trustProfile.calibration;
    const historicalSuccessRate =
      dto.historicalSuccessRate !== undefined
        ? dto.historicalSuccessRate
        : trustProfile.historicalSuccessRate;
    const failureRate = dto.failureRate !== undefined ? dto.failureRate : trustProfile.failureRate;
    const policyViolations =
      dto.policyViolations !== undefined ? dto.policyViolations : trustProfile.policyViolations;
    const sampleCount = dto.sampleCount !== undefined ? dto.sampleCount : trustProfile.sampleCount;

    let overallTrust = dto.overallTrust;
    if (overallTrust === undefined) {
      const weighted =
        accuracy * 0.3 +
        consistency * 0.2 +
        calibration * 0.2 +
        historicalSuccessRate * 0.3;
      const penalty = policyViolations * 0.05;
      overallTrust = Math.max(0, Math.min(1, weighted - penalty));
    }

    const updatedProfile: TrustProfile = {
      ...trustProfile,
      accuracy,
      consistency,
      calibration,
      historicalSuccessRate,
      failureRate,
      policyViolations,
      overallTrust: Number(overallTrust.toFixed(4)),
      sampleCount,
      updatedAt: new Date().toISOString()
    };

    const savedProfile = await this.repository.updateTrustProfile(updatedProfile);
    const updatedAgent = await this.repository.findAgentByName(agentName);

    return {
      success: true,
      data: updatedAgent ?? {
        ...agent,
        trustProfile: savedProfile
      },
      metadata: this.buildMetadata()
    };
  }
}
