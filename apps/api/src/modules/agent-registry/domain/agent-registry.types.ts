import type { AgentAvailability } from '@autonomous-enterprise/contracts';

export interface TrustProfile {
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

export interface AgentRegistration {
  id: string;
  agentName: string;
  version: string;
  model: string;
  capabilities: string[];
  availability: AgentAvailability;
  costPerCall: number;
  trustProfile?: TrustProfile;
  createdAt: string;
  updatedAt: string;
}

export interface TrustOutcome {
  success: boolean;
  confidence: number;
  policyViolation?: boolean;
}
