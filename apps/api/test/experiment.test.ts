import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Research Experiment Testbed', () => {
  let app: INestApplication;
  beforeEach(async () => { const module = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = module.createNestApplication(); await app.init(); });
  afterEach(async () => { await app.close(); });
  const headers = (tenantId: string) => ({ 'x-tenant-id': tenantId, 'x-actor-id': 'researcher', 'x-actor-roles': 'TENANT_ADMIN', 'x-actor-permissions': 'experiments:read,experiments:write' });
  const scenario = { name: 'Synthetic fulfillment success', scenarioType: 'SYNTHETIC_GOAL', definition: { scenarioType: 'SYNTHETIC_GOAL', input: { expectedSuccess: true } } };

  it('creates a tenant-scoped synthetic scenario and runs every research mode without business-data mutation', async () => {
    const tenant = 'tenant-experiment-modes';
    const created = await request(app.getHttpServer()).post('/api/v1/experiments/scenarios').set(headers(tenant)).send(scenario);
    expect(created.status).toBe(201);
    const scenarioId = created.body.data.id;
    const modes = ['DETERMINISTIC', 'SINGLE_AGENT', 'MULTI_AGENT', 'ORCHESTRATED', 'PROPOSED'];
    const runs = [];
    for (const mode of modes) {
      runs.push(
        await request(app.getHttpServer())
          .post(`/api/v1/experiments/scenarios/${scenarioId}/runs`)
          .set(headers(tenant))
          .send({ mode })
      );
    }
    expect(runs.every((res) => res.status === 201 && res.body.data.status === 'COMPLETED')).toBe(true);
    expect(runs[0].body.data.tokenCount).toBe(0);
    expect(runs[4].body.data.tokenCount).toBeGreaterThan(runs[0].body.data.tokenCount);
  });

  it('replays a prior run with an explicit replayOfRunId and compares results', async () => {
    const tenant = 'tenant-experiment-replay';
    const created = await request(app.getHttpServer()).post('/api/v1/experiments/scenarios').set(headers(tenant)).send(scenario);
    const scenarioId = created.body.data.id;
    const baseline = await request(app.getHttpServer()).post(`/api/v1/experiments/scenarios/${scenarioId}/runs`).set(headers(tenant)).send({ mode: 'DETERMINISTIC' });
    const candidate = await request(app.getHttpServer()).post(`/api/v1/experiments/scenarios/${scenarioId}/runs`).set(headers(tenant)).send({ mode: 'PROPOSED' });
    const replay = await request(app.getHttpServer()).post(`/api/v1/experiments/runs/${candidate.body.data.id}/replay`).set(headers(tenant));
    expect(replay.status).toBe(201);
    expect(replay.body.data.replayOfRunId).toBe(candidate.body.data.id);
    const comparison = await request(app.getHttpServer()).get('/api/v1/experiments/compare').query({ baselineRunId: baseline.body.data.id, candidateRunId: candidate.body.data.id }).set(headers(tenant));
    expect(comparison.status).toBe(200);
    expect(comparison.body.data.tokenDelta).toBeGreaterThan(0);
    expect(comparison.body.data.aiCostDeltaUsd).toBeGreaterThan(0);
  });

  it('shares scenarios and runs across the enterprise and 404s unknown runs', async () => {
    const owner = 'enterprise';
    const created = await request(app.getHttpServer()).post('/api/v1/experiments/scenarios').set(headers(owner)).send(scenario);
    const ownerRun = await request(app.getHttpServer()).post(`/api/v1/experiments/scenarios/${created.body.data.id}/runs`).set(headers(owner)).send({ mode: 'PROPOSED' });
    const list = await request(app.getHttpServer()).get('/api/v1/experiments/scenarios').set(headers(owner));
    expect(list.body.data.some((s: { id: string }) => s.id === created.body.data.id)).toBe(true);
    const getRun = await request(app.getHttpServer()).get(`/api/v1/experiments/runs/${ownerRun.body.data.id}`).set(headers(owner));
    expect(getRun.status).toBe(200);
    const missing = await request(app.getHttpServer()).get('/api/v1/experiments/runs/does-not-exist').set(headers(owner));
    expect(missing.status).toBe(404);
  });

  it('rejects unsupported scenarios and invalid experiment modes', async () => {
    const tenant = 'tenant-experiment-validation';
    const unsupported = await request(app.getHttpServer()).post('/api/v1/experiments/scenarios').set(headers(tenant)).send({ ...scenario, scenarioType: 'ORDER_FULFILLMENT' });
    expect(unsupported.status).toBe(400);
    const created = await request(app.getHttpServer()).post('/api/v1/experiments/scenarios').set(headers(tenant)).send(scenario);
    const invalidMode = await request(app.getHttpServer()).post(`/api/v1/experiments/scenarios/${created.body.data.id}/runs`).set(headers(tenant)).send({ mode: 'INVALID' });
    expect(invalidMode.status).toBe(400);
  });
});
