/**
 * Capacity planning for the infrastructure agent.
 *
 * Kept as a pure function, separate from SimulatorService, so the scaling
 * policy can be tested without a Kubernetes cluster, an LLM, or a running
 * simulator.
 *
 * The previous policy only looked at the size of the order backlog and stepped
 * replicas up by one per tick. That is too slow for a shopping event such as
 * 11.11: going from 2 to 10 replicas took 8 ticks, by which point the surge has
 * already been absorbed by an under-provisioned cluster. It also never scaled
 * back down, so cost stayed at the peak indefinitely.
 *
 * This policy instead derives a target replica count from the arrival *rate*
 * (orders per minute), which is what actually characterises a traffic spike,
 * and allows both scale-up and scale-down.
 */

export type CapacityDecisionKind = 'SCALE_UP' | 'SCALE_DOWN' | 'HOLD';

export interface CapacityInputs {
  /** Replicas the deployment is currently running. */
  currentReplicas: number;
  /** Orders observed per minute, derived from a sliding window. */
  ordersPerMinute: number;
  /** Orders not yet fulfilled. Used as a secondary pressure signal. */
  pendingOrders: number;
  /** Traffic mode; FLASH_SALE provisions headroom ahead of demand. */
  mode: 'NORMAL' | 'FLASH_SALE' | 'CHAOS';
  minReplicas?: number;
  maxReplicas?: number;
}

export interface CapacityDecision {
  kind: CapacityDecisionKind;
  targetReplicas: number;
  /** Replicas added (positive) or removed (negative). */
  replicaDelta: number;
  /** Hourly cost of the target footprint, not of the delta. */
  projectedCostUsd: number;
  reason: string;
  /** Sustained load per replica that produced the decision. */
  ordersPerReplica: number;
}

/**
 * One replica is assumed to absorb this many orders per minute. Derived from
 * the warehouse capacity model in HrisService (a picker handles ~4 orders), so
 * infrastructure and workforce capacity scale on comparable units.
 */
export const ORDERS_PER_MINUTE_PER_REPLICA = 12;

/** Hourly cost of a single replica, used for the Finance budget gate. */
export const REPLICA_HOURLY_COST_USD = 0.012;

export const DEFAULT_MIN_REPLICAS = 2;
export const DEFAULT_MAX_REPLICAS = 10;

/**
 * Scale-down is deliberately more reluctant than scale-up: removing capacity
 * during a lull that turns out to be temporary is far more damaging than
 * briefly paying for an extra replica. Capacity is only released once load sits
 * below 60% of the target footprint.
 */
const SCALE_DOWN_HYSTERESIS = 0.6;

/**
 * During a flash sale, provision ahead of observed demand rather than chasing
 * it. A shopping event's arrival rate climbs faster than the reconciliation
 * loop can react, so the measured rate is already stale by the time it is read.
 */
const FLASH_SALE_HEADROOM = 1.5;

export function planCapacity(inputs: CapacityInputs): CapacityDecision {
  const minReplicas = inputs.minReplicas ?? DEFAULT_MIN_REPLICAS;
  const maxReplicas = inputs.maxReplicas ?? DEFAULT_MAX_REPLICAS;

  const current = Math.max(0, inputs.currentReplicas);
  const rate = Math.max(0, inputs.ordersPerMinute);
  const backlog = Math.max(0, inputs.pendingOrders);

  // Backlog is work already owed, so it counts toward required capacity, but it
  // is spread over several minutes rather than treated as instantaneous load.
  const backlogPressure = backlog / 5;
  const effectiveLoad = rate + backlogPressure;

  const headroom = inputs.mode === 'FLASH_SALE' ? FLASH_SALE_HEADROOM : 1;
  const rawTarget = (effectiveLoad * headroom) / ORDERS_PER_MINUTE_PER_REPLICA;

  const target = Math.min(maxReplicas, Math.max(minReplicas, Math.ceil(rawTarget)));

  const ordersPerReplica = current > 0 ? Number((effectiveLoad / current).toFixed(2)) : effectiveLoad;
  const projectedCostUsd = Number((target * REPLICA_HOURLY_COST_USD).toFixed(4));

  if (target > current) {
    return {
      kind: 'SCALE_UP',
      targetReplicas: target,
      replicaDelta: target - current,
      projectedCostUsd,
      ordersPerReplica,
      reason:
        `Load ${effectiveLoad.toFixed(1)} orders/min (${rate.toFixed(1)} incoming + ${backlog} backlog) ` +
        `exceeds capacity of ${current} replica(s) at ${ORDERS_PER_MINUTE_PER_REPLICA}/min each` +
        (inputs.mode === 'FLASH_SALE' ? `; flash-sale headroom ${FLASH_SALE_HEADROOM}x applied` : '')
    };
  }

  if (target < current) {
    // Only release capacity once demand has fallen well below what the current
    // footprint supports, to avoid oscillating around the threshold.
    const currentCapacity = current * ORDERS_PER_MINUTE_PER_REPLICA;
    if (effectiveLoad > currentCapacity * SCALE_DOWN_HYSTERESIS) {
      return {
        kind: 'HOLD',
        targetReplicas: current,
        replicaDelta: 0,
        projectedCostUsd: Number((current * REPLICA_HOURLY_COST_USD).toFixed(4)),
        ordersPerReplica,
        reason:
          `Load ${effectiveLoad.toFixed(1)} orders/min is below capacity but still above the ` +
          `${Math.round(SCALE_DOWN_HYSTERESIS * 100)}% release threshold; holding ${current} replica(s)`
      };
    }

    return {
      kind: 'SCALE_DOWN',
      targetReplicas: target,
      replicaDelta: target - current,
      projectedCostUsd,
      ordersPerReplica,
      reason:
        `Load fell to ${effectiveLoad.toFixed(1)} orders/min; ${current} replica(s) are ` +
        `over-provisioned, releasing ${current - target} to cut cost`
    };
  }

  return {
    kind: 'HOLD',
    targetReplicas: current,
    replicaDelta: 0,
    projectedCostUsd: Number((current * REPLICA_HOURLY_COST_USD).toFixed(4)),
    ordersPerReplica,
    reason: `Load ${effectiveLoad.toFixed(1)} orders/min is matched by ${current} replica(s); no change needed`
  };
}

/**
 * Derives the order arrival rate from persisted order timestamps.
 *
 * Reading from the orders themselves rather than an in-memory counter means the
 * rate reflects every source of demand — the scripted sales step, agent tool
 * calls, and direct API traffic alike — and survives an API restart.
 */
export function ordersPerMinuteFrom(
  orders: Array<{ createdAt?: string }>,
  windowMs = 60_000,
  now: number = Date.now()
): number {
  const cutoff = now - windowMs;

  const withinWindow = orders.filter((order) => {
    if (!order.createdAt) return false;
    const createdAt = Date.parse(order.createdAt);
    return Number.isFinite(createdAt) && createdAt >= cutoff && createdAt <= now;
  }).length;

  if (withinWindow === 0) return 0;

  return Number(((withinWindow * 60_000) / windowMs).toFixed(2));
}
