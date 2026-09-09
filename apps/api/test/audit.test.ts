import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Audit Primitive & Agent Communication', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should capture structured audit records when actions are performed', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tenant/profile')
      .set('x-tenant-id', 'tenant-audit-test')
      .set('x-actor-id', 'auditor-user')
      .set('x-actor-roles', 'AUDITOR')
      .set('x-actor-permissions', 'tenant:read,audit:read');

    const auditResponse = await request(app.getHttpServer())
      .get('/api/v1/audit/logs')
      .set('x-tenant-id', 'tenant-audit-test')
      .set('x-actor-id', 'auditor-user')
      .set('x-actor-roles', 'AUDITOR')
      .set('x-actor-permissions', 'tenant:read,audit:read');

    expect(auditResponse.status).toBe(200);
    expect(auditResponse.body.success).toBe(true);
    expect(auditResponse.body.data.length).toBeGreaterThan(0);

    const log = auditResponse.body.data[0];
    expect(log.actor.id).toBe('auditor-user');
    expect(log.action).toBe('VIEW_TENANT_PROFILE');
    expect(log.status).toBe('SUCCESS');
    expect(log.auditId).toBeDefined();
    expect(log.timestamp).toBeDefined();
  });

  it('should process agent contract message and log structured audit entry', async () => {
    const agentMsg = {
      messageId: 'msg-001',
      tenantId: 'tenant-audit-test',
      workflowId: 'wf-100',
      sender: 'sales-agent',
      receiver: 'inventory-agent',
      intent: 'RESERVE_STOCK',
      payload: { sku: 'SKU-777', quantity: 2 },
      metadata: {
        confidence: 0.98,
        priority: 'high',
        timestamp: new Date().toISOString()
      }
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/agent/message')
      .set('x-tenant-id', 'tenant-audit-test')
      .set('x-actor-id', 'sales-agent')
      .set('x-actor-type', 'agent')
      .set('x-actor-roles', 'AI_SALES_AGENT')
      .set('x-actor-permissions', 'agent:execute')
      .send(agentMsg);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const auditLogs = await request(app.getHttpServer())
      .get('/api/v1/audit/logs')
      .set('x-tenant-id', 'tenant-audit-test')
      .set('x-actor-id', 'auditor-user')
      .set('x-actor-roles', 'AUDITOR')
      .set('x-actor-permissions', 'audit:read');

    const agentAudit = auditLogs.body.data.find((l: { action: string }) => l.action === 'AGENT_INTENT_RESERVE_STOCK');
    expect(agentAudit).toBeDefined();
    expect(agentAudit.agent).toBe('sales-agent');
    expect(agentAudit.workflowId).toBe('wf-100');
  });

  it('should reject agent message with invalid format per PRD 30', async () => {
    const invalidMsg = { invalid: true };

    const response = await request(app.getHttpServer())
      .post('/api/v1/agent/message')
      .set('x-tenant-id', 'tenant-audit-test')
      .set('x-actor-roles', 'AI_SALES_AGENT')
      .set('x-actor-permissions', 'agent:execute')
      .send(invalidMsg);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('PRD section 30 contract');
  });
});
