import { describe, expect, it } from 'vitest';
import { Role, type ActorIdentity, type AgentMessage } from '@autonomous-enterprise/contracts';
import {
  RequestContextStorage,
  evaluatePolicy,
  hasPermission,
  hasRole,
  isAgent,
  validateAgentMessage
} from '../src/index';

describe('Shared Package Primitives', () => {
  it('should manage request context isolation with AsyncLocalStorage', () => {
    const actor: ActorIdentity = {
      id: 'usr-1',
      type: 'user',
      roles: [Role.ADMIN],
      permissions: ['*']
    };

    RequestContextStorage.run({ actor }, () => {
      expect(RequestContextStorage.getActor()?.id).toBe('usr-1');
    });

    expect(RequestContextStorage.getActor()).toBeUndefined();
  });

  it('should enforce role and permission checks for users and agents', () => {
    const humanActor: ActorIdentity = {
      id: 'usr-100',
      type: 'user',
      roles: [Role.SALES_MANAGER],
      permissions: ['sales:read', 'sales:create']
    };

    const agentActor: ActorIdentity = {
      id: 'sales-bot-01',
      type: 'agent',
      roles: [Role.AI_SALES_AGENT],
      permissions: ['agent:execute', 'inventory:check']
    };

    expect(hasRole(humanActor, Role.SALES_MANAGER)).toBe(true);
    expect(hasRole(humanActor, Role.FINANCE_MANAGER)).toBe(false);
    expect(hasPermission(humanActor, 'sales:read')).toBe(true);
    expect(hasPermission(humanActor, 'finance:post')).toBe(false);

    expect(isAgent(agentActor)).toBe(true);
    expect(isAgent(humanActor)).toBe(false);
  });

  it('should evaluate deterministic policy rules correctly', () => {
    const rules = [
      { id: 'r-1', field: 'amount', operator: 'less_than' as const, value: 5000 },
      { id: 'r-2', field: 'currency', operator: 'equals' as const, value: 'USD' }
    ];

    expect(evaluatePolicy(rules, { amount: 1200, currency: 'USD' }).allowed).toBe(true);
    expect(evaluatePolicy(rules, { amount: 6000, currency: 'USD' }).allowed).toBe(false);
    expect(evaluatePolicy(rules, { amount: 1200, currency: 'EUR' }).allowed).toBe(false);
  });

  it('should validate structured inter-agent messages', () => {
    const validMessage: AgentMessage = {
      messageId: 'msg-01',
      workflowId: 'wf-100',
      sender: 'sales-agent',
      receiver: 'inventory-agent',
      intent: 'CHECK_STOCK',
      payload: { sku: 'SKU-100' },
      metadata: {
        confidence: 0.95,
        priority: 'high',
        timestamp: new Date().toISOString()
      }
    };

    expect(validateAgentMessage(validMessage)).toBe(true);
    expect(validateAgentMessage({ messageId: 'msg-incomplete' })).toBe(false);
  });
});
