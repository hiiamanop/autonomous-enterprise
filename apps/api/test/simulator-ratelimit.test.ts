import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitSupervisorService } from '../src/common/ai-provider/rate-limit-supervisor.service';
import { EventStreamService } from '../src/common/events/event-stream.service';
import { AuditService } from '../src/common/audit/audit.service';
import { SimulatorService } from '../src/modules/simulator/simulator.service';
import { OmniRouterClient } from '../src/common/ai-provider/omnirouter.client';

describe('RateLimitSupervisorService and Traffic Simulator', () => {
  let supervisor: RateLimitSupervisorService;
  let simulator: SimulatorService;
  let eventStream: EventStreamService;
  let omniRouter: { complete: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    omniRouter = {
      complete: vi.fn().mockResolvedValue({
        content: 'Decision: Proceed with scaling',
        inputTokens: 50,
        outputTokens: 20,
        model: 'Infrastructure',
        latencyMs: 120,
        estimatedCostUsd: 0.001
      })
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitSupervisorService,
        EventStreamService,
        AuditService,
        SimulatorService,
        { provide: OmniRouterClient, useValue: omniRouter }
      ]
    }).compile();

    supervisor = moduleRef.get(RateLimitSupervisorService);
    simulator = moduleRef.get(SimulatorService);
    eventStream = moduleRef.get(EventStreamService);
  });

  afterEach(() => {
    simulator.stop();
  });

  it('should trigger rate limit cooldown and report remaining seconds', () => {
    expect(supervisor.isPaused()).toBe(false);

    supervisor.recordRateLimit('Infrastructure', 10, 'Provider rate limit hit');
    expect(supervisor.isPaused()).toBe(true);

    const status = supervisor.getStatus();
    expect(status.isRateLimited).toBe(true);
    expect(status.cooldownRemainingSeconds).toBeGreaterThan(0);
    expect(status.triggeredByModel).toBe('Infrastructure');
  });

  it('should allow manual pause and resume of AI operations', () => {
    supervisor.manualPause(20, 'Manual maintenance');
    expect(supervisor.isPaused()).toBe(true);

    supervisor.manualResume();
    expect(supervisor.isPaused()).toBe(false);
  });

  it('should start and stop continuous traffic simulator', () => {
    const startStatus = simulator.start({ mode: 'NORMAL', intervalMs: 1000 });
    expect(startStatus.isRunning).toBe(true);
    expect(startStatus.mode).toBe('NORMAL');

    const stopStatus = simulator.stop();
    expect(stopStatus.isRunning).toBe(false);
  });

  it('should pause simulated traffic when rate limit supervisor is in cooldown', () => {
    simulator.start({ mode: 'FLASH_SALE', intervalMs: 2000 });
    supervisor.recordRateLimit('Infrastructure', 15);

    const status = simulator.getStatus();
    expect(status.pausedByRateLimit).toBe(true);
    expect(status.rateLimitCooldownSeconds).toBeGreaterThan(0);
  });
});
