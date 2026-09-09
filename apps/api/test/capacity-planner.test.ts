import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MAX_REPLICAS,
  DEFAULT_MIN_REPLICAS,
  ORDERS_PER_MINUTE_PER_REPLICA,
  REPLICA_HOURLY_COST_USD,
  ordersPerMinuteFrom,
  planCapacity
} from '../src/modules/simulator/capacity-planner';

describe('Infrastructure Capacity Planner', () => {
  const baseline = {
    currentReplicas: 2,
    ordersPerMinute: 0,
    pendingOrders: 0,
    mode: 'NORMAL' as const
  };

  it('holds capacity when demand matches the current footprint', () => {
    // 2 replicas absorb 24 orders/min; ask for slightly less than that.
    const decision = planCapacity({ ...baseline, ordersPerMinute: 20 });

    expect(decision.kind).toBe('HOLD');
    expect(decision.targetReplicas).toBe(2);
    expect(decision.replicaDelta).toBe(0);
  });

  it('never scales below the configured minimum, even with zero traffic', () => {
    const decision = planCapacity({ ...baseline, currentReplicas: DEFAULT_MIN_REPLICAS });

    expect(decision.targetReplicas).toBe(DEFAULT_MIN_REPLICAS);
    expect(decision.kind).toBe('HOLD');
  });

  it('jumps straight to the required replica count instead of stepping up by one', () => {
    // 96 orders/min needs 8 replicas at 12/min each. The previous policy would
    // have taken 6 ticks to get there; this must happen in a single decision.
    const decision = planCapacity({ ...baseline, currentReplicas: 2, ordersPerMinute: 96 });

    expect(decision.kind).toBe('SCALE_UP');
    expect(decision.targetReplicas).toBe(8);
    expect(decision.replicaDelta).toBe(6);
  });

  it('counts backlog as pressure spread over several minutes, not as instant load', () => {
    const withBacklog = planCapacity({ ...baseline, ordersPerMinute: 12, pendingOrders: 60 });

    // 12/min incoming + 60 backlog spread over 5 minutes = 24 effective.
    expect(withBacklog.targetReplicas).toBe(2);

    const heavierBacklog = planCapacity({ ...baseline, ordersPerMinute: 12, pendingOrders: 150 });
    expect(heavierBacklog.kind).toBe('SCALE_UP');
    expect(heavierBacklog.targetReplicas).toBeGreaterThan(2);
  });

  it('provisions extra headroom during a flash sale', () => {
    const normal = planCapacity({ ...baseline, ordersPerMinute: 48, mode: 'NORMAL' });
    const flashSale = planCapacity({ ...baseline, ordersPerMinute: 48, mode: 'FLASH_SALE' });

    expect(normal.targetReplicas).toBe(4);
    expect(flashSale.targetReplicas).toBe(6);
    expect(flashSale.reason).toContain('flash-sale headroom');
  });

  it('caps scale-up at the maximum replica count', () => {
    const decision = planCapacity({ ...baseline, ordersPerMinute: 10_000, mode: 'FLASH_SALE' });

    expect(decision.targetReplicas).toBe(DEFAULT_MAX_REPLICAS);
  });

  it('releases capacity once demand falls well below the current footprint', () => {
    // 8 replicas support 96/min; 10/min is far under the release threshold.
    const decision = planCapacity({ ...baseline, currentReplicas: 8, ordersPerMinute: 10 });

    expect(decision.kind).toBe('SCALE_DOWN');
    expect(decision.targetReplicas).toBeLessThan(8);
    expect(decision.replicaDelta).toBeLessThan(0);
  });

  it('holds rather than oscillating when load dips only slightly below capacity', () => {
    // 8 replicas support 96/min. 70/min is below capacity but above the 60%
    // (57.6/min) release threshold, so capacity must not be given up yet.
    const decision = planCapacity({ ...baseline, currentReplicas: 8, ordersPerMinute: 70 });

    expect(decision.kind).toBe('HOLD');
    expect(decision.targetReplicas).toBe(8);
  });

  it('prices the target footprint, not the delta', () => {
    const decision = planCapacity({ ...baseline, currentReplicas: 2, ordersPerMinute: 96 });

    expect(decision.targetReplicas).toBe(8);
    expect(decision.projectedCostUsd).toBeCloseTo(8 * REPLICA_HOURLY_COST_USD, 5);
  });

  it('reports load per replica so the decision can be audited', () => {
    const decision = planCapacity({ ...baseline, currentReplicas: 4, ordersPerMinute: 24 });

    expect(decision.ordersPerReplica).toBe(6);
    expect(ORDERS_PER_MINUTE_PER_REPLICA).toBe(12);
  });
});

describe('Order arrival rate derivation', () => {
  const now = Date.parse('2026-01-01T12:00:00.000Z');
  const at = (secondsAgo: number) => new Date(now - secondsAgo * 1000).toISOString();

  it('returns zero when there are no orders', () => {
    expect(ordersPerMinuteFrom([], 60_000, now)).toBe(0);
  });

  it('counts only orders inside the window', () => {
    const orders = [
      { createdAt: at(10) },
      { createdAt: at(30) },
      { createdAt: at(59) },
      { createdAt: at(120) } // outside the 60s window
    ];

    expect(ordersPerMinuteFrom(orders, 60_000, now)).toBe(3);
  });

  it('normalises to a per-minute figure for windows other than one minute', () => {
    const orders = [{ createdAt: at(5) }, { createdAt: at(10) }, { createdAt: at(20) }];

    // 3 orders in a 30s window is 6 per minute.
    expect(ordersPerMinuteFrom(orders, 30_000, now)).toBe(6);
  });

  it('ignores orders with a missing or unparseable timestamp', () => {
    const orders = [{ createdAt: at(10) }, { createdAt: 'not-a-date' }, {}];

    expect(ordersPerMinuteFrom(orders, 60_000, now)).toBe(1);
  });

  it('ignores timestamps in the future', () => {
    const orders = [{ createdAt: at(10) }, { createdAt: new Date(now + 60_000).toISOString() }];

    expect(ordersPerMinuteFrom(orders, 60_000, now)).toBe(1);
  });
});
