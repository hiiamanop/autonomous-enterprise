import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AI Cognitive Budget Manager', () => {
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
    'x-actor-permissions': 'ai-budget:read,ai-budget:write'
  });

  it('should return default budget status with zero usage for a new tenant', async () => {
    const tenantId = 'tenant-ai-budget-1';
    const res = await request(app.getHttpServer())
      .get('/api/v1/ai-budget/status')
      .set(headers(tenantId));

    expect(res.status).toBe(200);
    expect(res.body.data.dailyUsedUsd).toBe(0);
    expect(res.body.data.dailyRemainingUsd).toBe(10);
    expect(res.body.data.isDailyExceeded).toBe(false);
  });

  it('should allow configuring a lower budget and reflect it in status', async () => {
    const tenantId = 'tenant-ai-budget-2';
    const configRes = await request(app.getHttpServer())
      .post('/api/v1/ai-budget/configure')
      .set(headers(tenantId))
      .send({ dailyBudgetUsd: 1, monthlyBudgetUsd: 10 });

    expect(configRes.status).toBe(200);
    expect(configRes.body.data.dailyBudgetUsd).toBe(1);

    const statusRes = await request(app.getHttpServer())
      .get('/api/v1/ai-budget/status')
      .set(headers(tenantId));

    expect(statusRes.body.data.dailyRemainingUsd).toBe(1);
  });

  it('should apply the configured enterprise budget to all requests', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/ai-budget/configure')
      .set(headers('tenant-ai-budget-a'))
      .send({ dailyBudgetUsd: 2 });

    const otherStatus = await request(app.getHttpServer())
      .get('/api/v1/ai-budget/status')
      .set(headers('tenant-ai-budget-b'));

    expect(otherStatus.body.data.dailyRemainingUsd).toBe(2);
  });
});
