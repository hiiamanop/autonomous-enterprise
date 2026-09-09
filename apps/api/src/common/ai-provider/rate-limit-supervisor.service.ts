import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EventStreamService } from '../events/event-stream.service';
import { AuditService } from '../audit/audit.service';

export interface RateLimitStatus {
  isRateLimited: boolean;
  cooldownRemainingSeconds: number;
  pausedUntil: string | null;
  triggeredByModel: string | null;
  reason: string | null;
  consecutiveHits: number;
}

const DEFAULT_COOLDOWN_SECONDS = 30;

@Injectable()
export class RateLimitSupervisorService {
  private readonly logger = new Logger(RateLimitSupervisorService.name);
  private isRateLimited = false;
  private pausedUntilMs: number | null = null;
  private triggeredByModel: string | null = null;
  private reason: string | null = null;
  private consecutiveHits = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Optional() @Inject(EventStreamService) private readonly eventStream?: EventStreamService,
    @Optional() @Inject(AuditService) private readonly auditService?: AuditService
  ) {}

  getStatus(): RateLimitStatus {
    const now = Date.now();
    if (this.isRateLimited && this.pausedUntilMs && now >= this.pausedUntilMs) {
      this.resolveRateLimit();
    }

    const remainingMs = this.pausedUntilMs ? Math.max(0, this.pausedUntilMs - now) : 0;
    return {
      isRateLimited: this.isRateLimited,
      cooldownRemainingSeconds: Math.ceil(remainingMs / 1000),
      pausedUntil: this.pausedUntilMs ? new Date(this.pausedUntilMs).toISOString() : null,
      triggeredByModel: this.triggeredByModel,
      reason: this.reason,
      consecutiveHits: this.consecutiveHits
    };
  }

  isPaused(): boolean {
    return this.getStatus().isRateLimited;
  }

  recordRateLimit(model: string, retryAfterSeconds?: number, customReason?: string): RateLimitStatus {
    const cooldownSec = Math.max(5, retryAfterSeconds || DEFAULT_COOLDOWN_SECONDS);
    this.isRateLimited = true;
    this.consecutiveHits += 1;
    this.pausedUntilMs = Date.now() + cooldownSec * 1000;
    this.triggeredByModel = model;
    this.reason = customReason || `Rate limit encountered on model [${model}]. Global AI pause for ${cooldownSec}s.`;

    this.logger.warn(`AI Rate Limit triggered by [${model}]. Pausing all traffic for ${cooldownSec}s.`);

    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.resolveRateLimit();
    }, cooldownSec * 1000);

    const status = this.getStatus();

    if (this.eventStream) {
      this.eventStream.emit({
        action: 'AI_RATE_LIMIT_TRIGGERED',
        tenantId: 'system',
        actor: { id: 'rate-limit-supervisor', type: 'service' },
        timestamp: new Date().toISOString(),
        metadata: {
          model,
          cooldownSeconds: cooldownSec,
          pausedUntil: status.pausedUntil,
          reason: this.reason
        }
      });
    }

    if (this.auditService) {
      this.auditService.record({
        action: 'AI_RATE_LIMIT_TRIGGERED',
        input: { model, retryAfterSeconds: cooldownSec },
        output: { status },
        status: 'FAILURE',
        reasoning: this.reason
      });
    }

    return status;
  }

  manualPause(seconds = 30, reason = 'Operator manual AI pause'): RateLimitStatus {
    return this.recordRateLimit('manual', seconds, reason);
  }

  manualResume(): RateLimitStatus {
    this.resolveRateLimit();
    return this.getStatus();
  }

  private resolveRateLimit(): void {
    if (!this.isRateLimited) return;

    this.isRateLimited = false;
    this.pausedUntilMs = null;
    this.reason = null;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.logger.log('AI Rate Limit cooldown expired. Global AI operations resumed.');

    if (this.eventStream) {
      this.eventStream.emit({
        action: 'AI_RATE_LIMIT_RESOLVED',
        tenantId: 'system',
        actor: { id: 'rate-limit-supervisor', type: 'service' },
        timestamp: new Date().toISOString(),
        metadata: {
          resumedAt: new Date().toISOString()
        }
      });
    }

    if (this.auditService) {
      this.auditService.record({
        action: 'AI_RATE_LIMIT_RESOLVED',
        input: {},
        output: { resumed: true },
        status: 'SUCCESS'
      });
    }
  }
}
