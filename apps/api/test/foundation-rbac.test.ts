import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Foundation Agent Message RBAC', () => {
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

  it('should authorize agent message request with valid agent role and permissions', async () => {
    const agentMsg = {
      messageId: 'msg-rbac-001',
      tenantId: 'tenant-rbac-test',
      workflowId: 'wf-200',
      sender: 'sales-agent',
      receiver: 'inventory-agent',
      intent: 'CHECK_STOCK',
      payload: { sku: 'SKU-888', quantity: 5 },
      metadata: {
        confidence: 0.95,
        priority: 'medium',
        timestamp: new Date().toISOString()
      }
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/agent/message')
      .set('x-tenant-id', 'tenant-rbac-test')
      .set('x-actor-id', 'sales-agent')
      .set('x-actor-type', 'agent')
      .set('x-actor-roles', 'AI_SALES_AGENT')
      .set('x-actor-permissions', 'agent:execute')
      .send(agentMsg);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should forbid agent message request without required role or permission', async () => {
    const agentMsg = {
      messageId: 'msg-rbac-002',
      tenantId: 'tenant-rbac-test',
      workflowId: 'wf-200',
      sender: 'unauthorized-actor',
      receiver: 'inventory-agent',
      intent: 'CHECK_STOCK',
      payload: { sku: 'SKU-888', quantity: 5 },
      metadata: {
        confidence: 0.95,
        priority: 'medium',
        timestamp: new Date().toISOString()
      }
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/agent/message')
      .set('x-tenant-id', 'tenant-rbac-test')
      .set('x-actor-id', 'unauthorized-actor')
      .set('x-actor-roles', 'EMPLOYEE')
      .set('x-actor-permissions', 'sales:read')
      .send(agentMsg);

    expect(response.status).toBe(403);
  });
});
