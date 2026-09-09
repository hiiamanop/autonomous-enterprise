import { Injectable } from '@nestjs/common';
import type { ModelRoutingDecision, ModelTier, RoutingRequest } from './ai-provider.types';

const TIER_MODEL: Record<ModelTier, string | undefined> = {
  DETERMINISTIC: undefined,
  SMALL_MODEL: process.env.AI_MODEL_SMALL || 'small-classifier',
  REASONING_MODEL: process.env.AI_MODEL_REASONING || 'reasoning-model',
  HIGH_RELIABILITY_MODEL: process.env.AI_MODEL_HIGH_RELIABILITY || 'high-reliability-model'
};

@Injectable()
export class ModelRoutingService {
  route(request: RoutingRequest): ModelRoutingDecision {
    const reasons: string[] = [];

    if (request.complexity === 'SIMPLE_QUERY') {
      reasons.push('Simple query can be answered deterministically without invoking a model');
      return {
        tier: 'DETERMINISTIC',
        requiresPolicyValidation: false,
        requiresHumanApproval: false,
        reasons
      };
    }

    if (
      request.availableBudgetUsd <= 0 &&
      request.complexity !== 'COMPLEX_REASONING' &&
      request.complexity !== 'CRITICAL_DECISION'
    ) {
      reasons.push('No AI budget remaining; falling back to deterministic handling for low-risk task');
      return {
        tier: 'DETERMINISTIC',
        requiresPolicyValidation: false,
        requiresHumanApproval: false,
        reasons
      };
    }

    if (request.riskLevel === 'CRITICAL' || request.complexity === 'CRITICAL_DECISION') {
      reasons.push('Critical financial or business decision requires high-reliability model, policy validation, and possible human approval');
      return {
        tier: 'HIGH_RELIABILITY_MODEL',
        model: TIER_MODEL.HIGH_RELIABILITY_MODEL,
        requiresPolicyValidation: true,
        requiresHumanApproval: true,
        reasons
      };
    }

    if (request.complexity === 'COMPLEX_REASONING' || request.riskLevel === 'HIGH') {
      reasons.push('Complex business conflict or high risk requires a reasoning model with policy validation');
      return {
        tier: 'REASONING_MODEL',
        model: TIER_MODEL.REASONING_MODEL,
        requiresPolicyValidation: true,
        requiresHumanApproval: false,
        reasons
      };
    }

    if (request.complexity === 'SIMPLE_CLASSIFICATION') {
      reasons.push('Simple classification can use a small, low-cost model');
      return {
        tier: 'SMALL_MODEL',
        model: TIER_MODEL.SMALL_MODEL,
        requiresPolicyValidation: false,
        requiresHumanApproval: false,
        reasons
      };
    }

    reasons.push('Defaulting to reasoning model for unclassified moderate complexity task');
    return {
      tier: 'REASONING_MODEL',
      model: TIER_MODEL.REASONING_MODEL,
      requiresPolicyValidation: true,
      requiresHumanApproval: false,
      reasons
    };
  }
}
