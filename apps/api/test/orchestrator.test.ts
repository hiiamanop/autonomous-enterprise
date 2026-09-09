import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AI Orchestrator Goal Execution', () => {
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
    'x-actor-permissions': 'orchestrator:execute,agent-registry:read,agent-registry:write,ai-budget:read,ai-budget:write'
  });

  it('should route simple queries to deterministic tier without consuming AI budget', async () => {
    const tenantId = 'tenant-orch-1';
    const res = await request(app.getHttpServer())
      .post('/api/v1/orchestrator/goals')
      .set(headers(tenantId))
      .send({
        goal: 'Check stock for SKU-001',
        agentName: 'inventory-agent',
        complexity: 'SIMPLE_QUERY',
        riskLevel: 'LOW'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.routing.tier).toBe('DETERMINISTIC');
    expect(res.body.data.outcome).toBe('EXECUTE');

    const budgetRes = await request(app.getHttpServer())
      .get('/api/v1/ai-budget/status')
      .set(headers(tenantId));
    expect(budgetRes.body.data.dailyUsedUsd).toBe(0);
  });

  it('should route critical decisions to high-reliability tier requiring policy validation and human approval', async () => {
    const tenantId = 'tenant-orch-2';
    const res = await request(app.getHttpServer())
      .post('/api/v1/orchestrator/goals')
      .set(headers(tenantId))
      .send({
        goal: 'Approve large capital expenditure',
        agentName: 'finance-agent',
        complexity: 'CRITICAL_DECISION',
        riskLevel: 'CRITICAL',
        simulatedConfidence: 0.95
      });

    expect(res.status).toBe(200);
    expect(res.body.data.routing.tier).toBe('HIGH_RELIABILITY_MODEL');
    expect(res.body.data.routing.requiresPolicyValidation).toBe(true);
    expect(res.body.data.routing.requiresHumanApproval).toBe(true);
    expect(res.body.data.outcome).toBe('EXECUTE');
  });

  it('should consume AI budget and record usage when routing to a non-deterministic tier', async () => {
    const tenantId = 'tenant-orch-3';
    await request(app.getHttpServer())
      .post('/api/v1/orchestrator/goals')
      .set(headers(tenantId))
      .send({
        goal: 'Classify support ticket sentiment',
        agentName: 'classification-agent',
        complexity: 'SIMPLE_CLASSIFICATION',
        riskLevel: 'LOW',
        simulatedConfidence: 0.9
      });

    const budgetRes = await request(app.getHttpServer())
      .get('/api/v1/ai-budget/status')
      .set(headers(tenantId));

    expect(budgetRes.body.data.dailyUsedUsd).toBeGreaterThan(0);
  });

  it('should deny execution when AI budget is exhausted', async () => {
    const tenantId = 'tenant-orch-4';
    await request(app.getHttpServer())
      .post('/api/v1/ai-budget/configure')
      .set(headers(tenantId))
      .send({ dailyBudgetUsd: 0, monthlyBudgetUsd: 0, perTransactionBudgetUsd: 0 });

    const res = await request(app.getHttpServer())
      .post('/api/v1/orchestrator/goals')
      .set(headers(tenantId))
      .send({
        goal: 'Resolve complex business conflict',
        agentName: 'orchestrator-helper',
        complexity: 'COMPLEX_REASONING',
        riskLevel: 'MEDIUM',
        simulatedConfidence: 0.9
      });

    expect(res.status).toBe(200);
    expect(res.body.data.outcome).toBe('BUDGET_DENIED');
  });

  it('should trigger circuit breaker when confidence never meets minimum within iteration bound', async () => {
    const tenantId = 'tenant-orch-5';
    const res = await request(app.getHttpServer())
      .post('/api/v1/orchestrator/goals')
      .set(headers(tenantId))
      .send({
        goal: 'Uncertain reasoning task',
        agentName: 'uncertain-agent',
        complexity: 'COMPLEX_REASONING',
        riskLevel: 'MEDIUM',
        minConfidence: 0.99,
        maxIterations: 1,
        simulatedConfidence: 0.2
      });

    expect(res.status).toBe(200);
    expect(res.body.data.outcome).toBe('CIRCUIT_BROKEN');
    expect(res.body.data.ticketId).toBeDefined();
  });

  it('should update agent trust profile after goal execution', async () => {
    const tenantId = 'tenant-orch-6';
    await request(app.getHttpServer())
      .post('/api/v1/orchestrator/goals')
      .set(headers(tenantId))
      .send({
        goal: 'Simple classification for trust update',
        agentName: 'trust-test-agent',
        complexity: 'SIMPLE_CLASSIFICATION',
        riskLevel: 'LOW',
        simulatedConfidence: 0.95
      });

    const agentRes = await request(app.getHttpServer())
      .get('/api/v1/agent-registry/trust-test-agent')
      .set(headers(tenantId));

    expect(agentRes.status).toBe(200);
    expect(agentRes.body.data.trustProfile.sampleCount).toBe(1);
  });
});
