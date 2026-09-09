import { AsyncLocalStorage } from 'node:async_hooks';
import { Role, type ActorIdentity, type AgentMessage, type RequestContext, type TenantContext } from '@autonomous-enterprise/contracts';

const requestAsyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export class RequestContextStorage {
  static run<R>(context: RequestContext, fn: () => R): R {
    return requestAsyncLocalStorage.run(context, fn);
  }

  static getContext(): RequestContext | undefined {
    return requestAsyncLocalStorage.getStore();
  }

  static getActor(): ActorIdentity | undefined {
    return requestAsyncLocalStorage.getStore()?.actor;
  }
}

export class TenantContextStorage {
  static run<R>(context: TenantContext | RequestContext, fn: () => R): R {
    return requestAsyncLocalStorage.run(context, fn);
  }

  static getContext(): RequestContext | undefined {
    return requestAsyncLocalStorage.getStore();
  }

  static getTenantId(): string | undefined {
    const context = requestAsyncLocalStorage.getStore() as RequestContext & { tenantId?: string } | undefined;
    return context?.tenantId || 'enterprise';
  }

  static getActor(): ActorIdentity | undefined {
    return requestAsyncLocalStorage.getStore()?.actor;
  }
}

export function hasRole(actor: ActorIdentity, requiredRole: Role | string): boolean {
  const roles = actor.roles || [];
  if (roles.includes(Role.SUPER_ADMIN)) {
    return true;
  }
  return roles.includes(requiredRole);
}

export function hasPermission(actor: ActorIdentity, requiredPermission: string): boolean {
  const roles = actor.roles || [];
  const permissions = actor.permissions || [];
  if (roles.includes(Role.SUPER_ADMIN)) {
    return true;
  }
  if (permissions.includes('*')) {
    return true;
  }
  return permissions.includes(requiredPermission);
}

export function isAgent(actor: ActorIdentity): boolean {
  return actor.type === 'agent';
}

export interface PolicyRule {
  id: string;
  field: string;
  operator: 'equals' | 'less_than' | 'greater_than' | 'in';
  value: unknown;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  ruleId?: string;
  reason?: string;
}

export function evaluatePolicy(
  rules: PolicyRule[],
  contextData: Record<string, unknown>
): PolicyEvaluationResult {
  for (const rule of rules) {
    const actualValue = contextData[rule.field];

    if (actualValue === undefined || actualValue === null) {
      return {
        allowed: false,
        ruleId: rule.id,
        reason: `Missing required context field for policy: ${rule.field}`
      };
    }

    if (rule.operator === 'equals' && actualValue !== rule.value) {
      return {
        allowed: false,
        ruleId: rule.id,
        reason: `Policy check failed: ${rule.field} (${String(actualValue)}) !== expected (${String(rule.value)})`
      };
    }

    if (rule.operator === 'less_than') {
      const numActual = Number(actualValue);
      const numExpected = Number(rule.value);
      if (isNaN(numActual) || isNaN(numExpected) || numActual >= numExpected) {
        return {
          allowed: false,
          ruleId: rule.id,
          reason: `Policy check failed: ${rule.field} (${numActual}) is not < ${numExpected}`
        };
      }
    }

    if (rule.operator === 'greater_than') {
      const numActual = Number(actualValue);
      const numExpected = Number(rule.value);
      if (isNaN(numActual) || isNaN(numExpected) || numActual <= numExpected) {
        return {
          allowed: false,
          ruleId: rule.id,
          reason: `Policy check failed: ${rule.field} (${numActual}) is not > ${numExpected}`
        };
      }
    }

    if (rule.operator === 'in' && Array.isArray(rule.value)) {
      if (!rule.value.includes(actualValue)) {
        return {
          allowed: false,
          ruleId: rule.id,
          reason: `Policy check failed: ${rule.field} (${String(actualValue)}) is not in allowed set`
        };
      }
    }
  }

  return { allowed: true };
}

export function validateAgentMessage(msg: unknown): msg is AgentMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  const record = msg as Record<string, unknown>;

  return (
    typeof record.messageId === 'string' &&
    typeof record.workflowId === 'string' &&
    typeof record.sender === 'string' &&
    typeof record.receiver === 'string' &&
    typeof record.intent === 'string' &&
    typeof record.payload === 'object' &&
    record.payload !== null &&
    typeof record.metadata === 'object' &&
    record.metadata !== null &&
    typeof (record.metadata as Record<string, unknown>).confidence === 'number'
  );
}
