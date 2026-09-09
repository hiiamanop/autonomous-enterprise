import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Financial Posting Workflow Integration Slice', () => {
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
    'x-actor-permissions': 'accounting:read,accounting:write,accounting:post'
  });

  async function setupAccounts(app: INestApplication, tenantId: string) {
    const cashRes = await request(app.getHttpServer())
      .post('/api/v1/accounting/chart-of-accounts')
      .set(headers(tenantId))
      .send({ code: '1000', name: 'Cash', type: 'ASSET' });
    const revenueRes = await request(app.getHttpServer())
      .post('/api/v1/accounting/chart-of-accounts')
      .set(headers(tenantId))
      .send({ code: '4000', name: 'Revenue', type: 'REVENUE' });
    return { cashId: cashRes.body.data.id, revenueId: revenueRes.body.data.id };
  }

  it('should auto-approve and post a balanced journal within threshold', async () => {
    const tenantId = 'tenant-fp-auto';
    const { cashId, revenueId } = await setupAccounts(app, tenantId);

    const journalRes = await request(app.getHttpServer())
      .post('/api/v1/accounting/journals')
      .set(headers(tenantId))
      .send({
        reference: 'JRN-001',
        entries: [
          { accountId: cashId, direction: 'DEBIT', amount: 1000 },
          { accountId: revenueId, direction: 'CREDIT', amount: 1000 }
        ]
      });
    expect(journalRes.status).toBe(201);
    const journalId = journalRes.body.data.id;

    const workflowRes = await request(app.getHttpServer())
      .post('/api/v1/workflows/financial-posting')
      .set(headers(tenantId))
      .send({ journalId });

    expect(workflowRes.status).toBe(200);
    expect(workflowRes.body.data.policy.decision).toBe('AUTO_APPROVE');
    expect(workflowRes.body.data.journalStatus).toBe('POSTED');

    const journalCheck = await request(app.getHttpServer())
      .get(`/api/v1/accounting/journals/${journalId}`)
      .set(headers(tenantId));
    expect(journalCheck.body.data.status).toBe('POSTED');
  });

  it('should require human approval when posting amount exceeds threshold', async () => {
    const tenantId = 'tenant-fp-threshold';
    const { cashId, revenueId } = await setupAccounts(app, tenantId);

    const journalRes = await request(app.getHttpServer())
      .post('/api/v1/accounting/journals')
      .set(headers(tenantId))
      .send({
        reference: 'JRN-002',
        entries: [
          { accountId: cashId, direction: 'DEBIT', amount: 50000 },
          { accountId: revenueId, direction: 'CREDIT', amount: 50000 }
        ]
      });
    const journalId = journalRes.body.data.id;

    const workflowRes = await request(app.getHttpServer())
      .post('/api/v1/workflows/financial-posting')
      .set(headers(tenantId))
      .send({ journalId, autoApprovalThreshold: 10000 });

    expect(workflowRes.status).toBe(200);
    expect(workflowRes.body.data.policy.decision).toBe('REQUIRE_HUMAN_APPROVAL');

    const journalCheck = await request(app.getHttpServer())
      .get(`/api/v1/accounting/journals/${journalId}`)
      .set(headers(tenantId));
    expect(journalCheck.body.data.status).toBe('DRAFT');
  });

  it('should not post journal twice through the workflow', async () => {
    const tenantId = 'tenant-fp-doublepost';
    const { cashId, revenueId } = await setupAccounts(app, tenantId);

    const journalRes = await request(app.getHttpServer())
      .post('/api/v1/accounting/journals')
      .set(headers(tenantId))
      .send({
        reference: 'JRN-003',
        entries: [
          { accountId: cashId, direction: 'DEBIT', amount: 200 },
          { accountId: revenueId, direction: 'CREDIT', amount: 200 }
        ]
      });
    const journalId = journalRes.body.data.id;

    const first = await request(app.getHttpServer())
      .post('/api/v1/workflows/financial-posting')
      .set(headers(tenantId))
      .send({ journalId });
    expect(first.body.data.journalStatus).toBe('POSTED');

    const second = await request(app.getHttpServer())
      .post('/api/v1/workflows/financial-posting')
      .set(headers(tenantId))
      .send({ journalId });

    expect(second.status).toBe(400);
  });
});
