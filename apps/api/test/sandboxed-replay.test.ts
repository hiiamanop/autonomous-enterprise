import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Sandboxed workflow replay', () => {
  let app: INestApplication;
  beforeEach(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  const headers = (tenantId: string, roles = 'TENANT_ADMIN', permissions = 'experiments:write') => ({
    'x-tenant-id': tenantId,
    'x-actor-id': 'replay-operator',
    'x-actor-roles': roles,
    'x-actor-permissions': permissions
  });

  it.each(['DETERMINISTIC', 'PROPOSED'])('replays a %s workflow in an isolated sandbox', async (mode) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/experiments/sandboxed-replay')
      .set(headers('production-tenant'))
      .send({ mode, scenarioDefinition: { scenarioType: 'FULFILLMENT', input: { expectedSuccess: true } } });

    expect(response.status).toBe(201);
    expect(response.body.data.isSandboxed).toBe(true);
    expect(response.body.data.zeroProductionMutation).toBe(true);
    expect(response.body.data.sandboxId).toMatch(/^sandbox_/);
    expect(response.body.data.replayRun.id).toBeDefined();
  });

  it('compares deterministic baseline with a proposed trust and budget aware replay', async () => {
    const tenant = 'comparison-tenant';
    const scenario = await request(app.getHttpServer()).post('/api/v1/experiments/scenarios').set(headers(tenant)).send({
      name: 'Real workflow scenario',
      scenarioType: 'SYNTHETIC_GOAL',
      definition: { scenarioType: 'SYNTHETIC_GOAL', input: { expectedSuccess: true } }
    });
    const scenarioId = scenario.body.data.id;
    await request(app.getHttpServer()).post(`/api/v1/experiments/scenarios/${scenarioId}/runs`).set(headers(tenant)).send({ mode: 'DETERMINISTIC' });
    const replay = await request(app.getHttpServer()).post('/api/v1/experiments/sandboxed-replay').set(headers(tenant)).send({ scenarioId, mode: 'PROPOSED', budgetUsd: 1 });

    expect(replay.status).toBe(201);
    expect(replay.body.data.comparison.baselineRunId).toBeDefined();
    expect(replay.body.data.comparison.deltas.tokens).toBeGreaterThan(0);
    expect(replay.body.data.replayRun.finalResult).toMatchObject({ trustAware: true, budgetAware: true });
  });

  it('rejects actors without the required role or permission', async () => {
    const noRole = await request(app.getHttpServer()).post('/api/v1/experiments/sandboxed-replay').set(headers('tenant', 'EMPLOYEE')).send({ mode: 'DETERMINISTIC', scenarioDefinition: { scenarioType: 'X', input: {} } });
    const noPermission = await request(app.getHttpServer()).post('/api/v1/experiments/sandboxed-replay').set(headers('tenant', 'TENANT_ADMIN', 'experiments:read')).send({ mode: 'DETERMINISTIC', scenarioDefinition: { scenarioType: 'X', input: {} } });
    expect(noRole.status).toBe(403);
    expect(noPermission.status).toBe(403);
  });
});
