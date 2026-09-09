import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Observability Snapshot (Business + AI + Infrastructure)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const headers = (tenantId: string) => ({
    'x-tenant-id': tenantId,
    'x-actor-id': 'user-admin',
    'x-actor-roles': 'TENANT_ADMIN',
    'x-actor-permissions': 'observability:read,hris:read,hris:write,agent-registry:read,agent-registry:write'
  });

  it('should return a zeroed snapshot for a brand new enterprise instance', async () => {
    const tenantId = 'tenant-observability-1';
    const res = await request(app.getHttpServer())
      .get('/api/v1/observability/snapshot')
      .set(headers(tenantId));

    expect(res.status).toBe(200);
    expect(res.body.data.enterpriseId).toBeDefined();
    expect(res.body.data.business.totalAuditEvents).toBe(0);
    expect(res.body.data.ai.agentCount).toBe(0);
    expect(res.body.data.infrastructure.totalScalingEvents).toBe(0);
  });

  it('should reflect audit events and agent registrations in the snapshot', async () => {
    const tenantId = 'tenant-observability-2';

    await request(app.getHttpServer())
      .post('/api/v1/hris/departments')
      .set(headers(tenantId))
      .send({ name: 'Ops' });

    await request(app.getHttpServer())
      .post('/api/v1/agent-registry')
      .set(headers(tenantId))
      .send({
        agentName: 'observability-test-agent',
        version: '1.0.0',
        model: 'local-model',
        capabilities: ['test']
      });

    const res = await request(app.getHttpServer())
      .get('/api/v1/observability/snapshot')
      .set(headers(tenantId));

    expect(res.status).toBe(200);
    expect(res.body.data.business.totalAuditEvents).toBeGreaterThan(0);
    expect(res.body.data.business.actionsByType['CREATE_DEPARTMENT']).toBeGreaterThanOrEqual(1);
    expect(res.body.data.ai.agentCount).toBe(1);
  });

  it('should expose enterprise-wide audit events on the observability snapshot', async () => {
    const actorA = 'tenant-observability-a';
    const actorB = 'tenant-observability-b';

    await request(app.getHttpServer())
      .post('/api/v1/hris/departments')
      .set(headers(actorA))
      .send({ name: 'Ops A' });

    const resB = await request(app.getHttpServer())
      .get('/api/v1/observability/snapshot')
      .set(headers(actorB));

    expect(resB.body.data.business.totalAuditEvents).toBeGreaterThan(0);
  });

  it('should reject snapshot request without observability:read permission', async () => {
    const tenantId = 'tenant-observability-forbidden';
    const res = await request(app.getHttpServer())
      .get('/api/v1/observability/snapshot')
      .set({
        'x-tenant-id': tenantId,
        'x-actor-id': 'user-noperm',
        'x-actor-roles': 'TENANT_ADMIN',
        'x-actor-permissions': ''
      });

    expect(res.status).toBe(403);
  });
});
