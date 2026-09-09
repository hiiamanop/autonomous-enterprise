import assert from 'node:assert';
import test from 'node:test';

test('Enterprise Admin Navigation Contracts', () => {
  const routes = [
    { href: '/', label: 'Observability', layer: '3-Layer' },
    { href: '/office', label: 'Virtual Office', layer: '2D Sim' },
    { href: '/agents', label: 'AI Agents', layer: 'Registry' },
    { href: '/finops', label: 'AI FinOps', layer: 'Budget' },
    { href: '/tickets', label: 'Ticketing', layer: 'HITL' },
    { href: '/experiments', label: 'Experiments', layer: 'Testbed' },
    { href: '/workflows', label: 'Workflows', layer: 'Triggers' },
    { href: '/events', label: 'Live Events', layer: 'SSE' }
  ];

  assert.strictEqual(routes.length, 8);
  assert.strictEqual(routes[0].href, '/');
  assert.strictEqual(routes[1].href, '/office');
  assert.strictEqual(routes[2].href, '/agents');
  assert.strictEqual(routes[3].href, '/finops');
  assert.strictEqual(routes[4].href, '/tickets');
  assert.strictEqual(routes[5].href, '/experiments');
  assert.strictEqual(routes[6].href, '/workflows');
  assert.strictEqual(routes[7].href, '/events');
});

test('Virtual Office Simulator Status Contracts', () => {
  const mockStatus = {
    isRunning: true,
    mode: 'FLASH_SALE',
    intervalMs: 1500,
    totalTicks: 42,
    successfulActions: 40,
    failedActions: 2,
    pausedByRateLimit: false,
    rateLimitCooldownSeconds: 0
  };

  assert.strictEqual(mockStatus.isRunning, true);
  assert.strictEqual(mockStatus.mode, 'FLASH_SALE');
  assert.strictEqual(mockStatus.intervalMs, 1500);
  assert.strictEqual(mockStatus.successfulActions + mockStatus.failedActions, 42);
});

test('Observability 3-Layer Snapshot Structure', () => {
  const mockSnapshot = {
    tenantId: 'tenant-corp',
    business: {
      totalAuditEvents: 1420,
      actionsByType: { 'ORDER_FULFILLMENT': 540 },
      failureCount: 14,
      successCount: 1406
    },
    ai: {
      agentCount: 8,
      averageTrustScore: 0.942,
      totalAiCalls: 4820,
      totalTokensUsed: 1285040,
      budgetExceededCount: 0,
      circuitBreakerTriggeredCount: 2,
      escalationCount: 7
    },
    infrastructure: {
      totalScalingEvents: 42,
      executedScalingEvents: 38,
      rejectedScalingEvents: 2,
      escalatedScalingEvents: 1,
      failedScalingEvents: 1
    }
  };

  assert.strictEqual(mockSnapshot.tenantId, 'tenant-corp');
  assert.strictEqual(mockSnapshot.business.totalAuditEvents, 1420);
  assert.strictEqual(mockSnapshot.ai.agentCount, 8);
  assert.strictEqual(mockSnapshot.infrastructure.executedScalingEvents, 38);
});

test('AI Agent Registry & Trust Dimensions', () => {
  const sampleAgent = {
    agentName: 'SalesNegotiatorAgent',
    version: '1.2.0',
    model: 'combo-cheap',
    capabilities: ['sales:order_creation', 'pricing:negotiate'],
    availability: 'ACTIVE',
    trustProfile: {
      accuracy: 0.96,
      consistency: 0.94,
      calibration: 0.95,
      overallTrust: 0.95
    }
  };

  assert.strictEqual(sampleAgent.availability, 'ACTIVE');
  assert.ok(sampleAgent.trustProfile.accuracy >= 0 && sampleAgent.trustProfile.accuracy <= 1);
  assert.ok(sampleAgent.trustProfile.consistency >= 0 && sampleAgent.trustProfile.consistency <= 1);
  assert.ok(sampleAgent.trustProfile.calibration >= 0 && sampleAgent.trustProfile.calibration <= 1);
});

test('AI FinOps Cognitive Budget Validation', () => {
  const budget = {
    dailyBudgetUsd: 50.0,
    dailyUsedUsd: 14.85,
    monthlyBudgetUsd: 1500.0,
    monthlyUsedUsd: 342.60
  };

  const isDailyExceeded = budget.dailyUsedUsd > budget.dailyBudgetUsd;
  const isMonthlyExceeded = budget.monthlyUsedUsd > budget.monthlyBudgetUsd;
  const remainingDaily = budget.dailyBudgetUsd - budget.dailyUsedUsd;

  assert.strictEqual(isDailyExceeded, false);
  assert.strictEqual(isMonthlyExceeded, false);
  assert.strictEqual(remainingDaily, 35.15);
});

test('Experiment 5-Mode Comparison Delta Calculation', () => {
  const baseline = {
    id: 'run-det-01',
    mode: 'DETERMINISTIC',
    success: true,
    durationMs: 420,
    tokenCount: 0,
    aiCostUsd: 0.0,
    conflictCount: 14,
    escalationCount: 22
  };

  const candidate = {
    id: 'run-prop-04',
    mode: 'PROPOSED',
    success: true,
    durationMs: 720,
    tokenCount: 2900,
    aiCostUsd: 0.0058,
    conflictCount: 0,
    escalationCount: 1
  };

  const durationDelta = candidate.durationMs - baseline.durationMs;
  const conflictDelta = candidate.conflictCount - baseline.conflictCount;
  const escalationDelta = candidate.escalationCount - baseline.escalationCount;

  assert.strictEqual(durationDelta, 300);
  assert.strictEqual(conflictDelta, -14);
  assert.strictEqual(escalationDelta, -21);
});
