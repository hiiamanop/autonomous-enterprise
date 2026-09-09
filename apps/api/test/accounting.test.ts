import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Accounting Module Domain & REST APIs', () => {
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

  it('should create chart of accounts', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/accounting/chart-of-accounts')
      .set('x-tenant-id', 'tenant-acc-1')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:write,accounting:read')
      .send({
        code: '1000',
        name: 'Cash and Cash Equivalents',
        type: 'ASSET'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe('1000');
    expect(res.body.data.type).toBe('ASSET');

    const duplicateRes = await request(app.getHttpServer())
      .post('/api/v1/accounting/chart-of-accounts')
      .set('x-tenant-id', 'tenant-acc-1')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:write,accounting:read')
      .send({
        code: '1000',
        name: 'Duplicate Cash Account',
        type: 'ASSET'
      });

    expect(duplicateRes.status).toBe(400);
  });

  it('should create journal with balanced entries and fail when unbalanced', async () => {
    const cashRes = await request(app.getHttpServer())
      .post('/api/v1/accounting/chart-of-accounts')
      .set('x-tenant-id', 'tenant-acc-balance')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:write,accounting:read')
      .send({
        code: '1010',
        name: 'Cash',
        type: 'ASSET'
      });
    const cashId = cashRes.body.data.id;

    const revRes = await request(app.getHttpServer())
      .post('/api/v1/accounting/chart-of-accounts')
      .set('x-tenant-id', 'tenant-acc-balance')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:write,accounting:read')
      .send({
        code: '4000',
        name: 'Sales Revenue',
        type: 'REVENUE'
      });
    const revId = revRes.body.data.id;

    const unbalancedRes = await request(app.getHttpServer())
      .post('/api/v1/accounting/journals')
      .set('x-tenant-id', 'tenant-acc-balance')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:write')
      .send({
        reference: 'JRN-UNBAL-001',
        description: 'Unbalanced Journal',
        entries: [
          { accountId: cashId, direction: 'DEBIT', amount: 500 },
          { accountId: revId, direction: 'CREDIT', amount: 300 }
        ]
      });

    expect(unbalancedRes.status).toBe(400);
    expect(unbalancedRes.body.message).toContain('Journal entries must balance');

    const balancedRes = await request(app.getHttpServer())
      .post('/api/v1/accounting/journals')
      .set('x-tenant-id', 'tenant-acc-balance')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:write')
      .send({
        reference: 'JRN-BAL-001',
        description: 'Balanced Journal',
        entries: [
          { accountId: cashId, direction: 'DEBIT', amount: 500, memo: 'Cash Inflow' },
          { accountId: revId, direction: 'CREDIT', amount: 500, memo: 'Revenue recognition' }
        ]
      });

    expect(balancedRes.status).toBe(201);
    expect(balancedRes.body.success).toBe(true);
    expect(balancedRes.body.data.status).toBe('DRAFT');
    expect(balancedRes.body.data.entries.length).toBe(2);
  });

  it('should post journal and reject duplicate post', async () => {
    const acc1Res = await request(app.getHttpServer())
      .post('/api/v1/accounting/chart-of-accounts')
      .set('x-tenant-id', 'tenant-acc-post')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:write')
      .send({ code: '1001', name: 'Cash', type: 'ASSET' });

    const acc2Res = await request(app.getHttpServer())
      .post('/api/v1/accounting/chart-of-accounts')
      .set('x-tenant-id', 'tenant-acc-post')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:write')
      .send({ code: '2001', name: 'Accounts Payable', type: 'LIABILITY' });

    const jrnRes = await request(app.getHttpServer())
      .post('/api/v1/accounting/journals')
      .set('x-tenant-id', 'tenant-acc-post')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:write')
      .send({
        reference: 'JRN-POST-001',
        entries: [
          { accountId: acc1Res.body.data.id, direction: 'DEBIT', amount: 1000 },
          { accountId: acc2Res.body.data.id, direction: 'CREDIT', amount: 1000 }
        ]
      });

    const journalId = jrnRes.body.data.id;

    const postRes = await request(app.getHttpServer())
      .post(`/api/v1/accounting/journals/${journalId}/post`)
      .set('x-tenant-id', 'tenant-acc-post')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:post');

    expect(postRes.status).toBe(201);
    expect(postRes.body.success).toBe(true);
    expect(postRes.body.data.status).toBe('POSTED');
    expect(postRes.body.data.postedAt).toBeDefined();

    const postAgainRes = await request(app.getHttpServer())
      .post(`/api/v1/accounting/journals/${journalId}/post`)
      .set('x-tenant-id', 'tenant-acc-post')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:post');

    expect(postAgainRes.status).toBe(400);
    expect(postAgainRes.body.message).toContain('Journal is already posted');
  });

  it('should reverse a POSTED journal creating an inverted reversal journal', async () => {
    const acc1Res = await request(app.getHttpServer())
      .post('/api/v1/accounting/chart-of-accounts')
      .set('x-tenant-id', 'tenant-acc-reverse')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:write')
      .send({ code: '1002', name: 'Cash', type: 'ASSET' });

    const acc2Res = await request(app.getHttpServer())
      .post('/api/v1/accounting/chart-of-accounts')
      .set('x-tenant-id', 'tenant-acc-reverse')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:write')
      .send({ code: '3001', name: 'Equity Capital', type: 'EQUITY' });

    const jrnRes = await request(app.getHttpServer())
      .post('/api/v1/accounting/journals')
      .set('x-tenant-id', 'tenant-acc-reverse')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:write')
      .send({
        reference: 'JRN-REV-001',
        entries: [
          { accountId: acc1Res.body.data.id, direction: 'DEBIT', amount: 2500, memo: 'Capital contribution' },
          { accountId: acc2Res.body.data.id, direction: 'CREDIT', amount: 2500, memo: 'Owner equity' }
        ]
      });

    const journalId = jrnRes.body.data.id;

    const earlyReverseRes = await request(app.getHttpServer())
      .post(`/api/v1/accounting/journals/${journalId}/reverse`)
      .set('x-tenant-id', 'tenant-acc-reverse')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:post');

    expect(earlyReverseRes.status).toBe(400);

    await request(app.getHttpServer())
      .post(`/api/v1/accounting/journals/${journalId}/post`)
      .set('x-tenant-id', 'tenant-acc-reverse')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:post');

    const reverseRes = await request(app.getHttpServer())
      .post(`/api/v1/accounting/journals/${journalId}/reverse`)
      .set('x-tenant-id', 'tenant-acc-reverse')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:post');

    expect(reverseRes.status).toBe(201);
    expect(reverseRes.body.success).toBe(true);
    expect(reverseRes.body.data.reference).toBe('REVERSAL-JRN-REV-001');
    expect(reverseRes.body.data.status).toBe('POSTED');

    const reversalEntries = reverseRes.body.data.entries;
    expect(reversalEntries.length).toBe(2);

    const debitReversal = reversalEntries.find((e: any) => e.accountId === acc2Res.body.data.id);
    const creditReversal = reversalEntries.find((e: any) => e.accountId === acc1Res.body.data.id);
    expect(debitReversal.direction).toBe('DEBIT');
    expect(creditReversal.direction).toBe('CREDIT');

    const originalCheck = await request(app.getHttpServer())
      .get(`/api/v1/accounting/journals/${journalId}`)
      .set('x-tenant-id', 'tenant-acc-reverse')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:read');

    expect(originalCheck.body.data.status).toBe('REVERSED');
  });

  it('should create invoice, issue, and record partial and full payments', async () => {
    const invRes = await request(app.getHttpServer())
      .post('/api/v1/accounting/invoices')
      .set('x-tenant-id', 'tenant-acc-inv')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:write')
      .send({
        type: 'RECEIVABLE',
        counterparty: 'Acme Corp',
        amount: 1000,
        dueDate: '2026-10-01T00:00:00.000Z'
      });

    expect(invRes.status).toBe(201);
    expect(invRes.body.data.status).toBe('DRAFT');
    expect(invRes.body.data.paidAmount).toBe(0);
    const invoiceId = invRes.body.data.id;

    const issueRes = await request(app.getHttpServer())
      .post(`/api/v1/accounting/invoices/${invoiceId}/issue`)
      .set('x-tenant-id', 'tenant-acc-inv')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:write');

    expect(issueRes.status).toBe(201);
    expect(issueRes.body.data.status).toBe('ISSUED');

    const excessPaymentRes = await request(app.getHttpServer())
      .post('/api/v1/accounting/payments')
      .set('x-tenant-id', 'tenant-acc-inv')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:write')
      .send({
        invoiceId,
        amount: 1500,
        method: 'BANK_TRANSFER'
      });

    expect(excessPaymentRes.status).toBe(400);
    expect(excessPaymentRes.body.message).toContain('Payment amount exceeds remaining invoice balance');

    const partialPaymentRes = await request(app.getHttpServer())
      .post('/api/v1/accounting/payments')
      .set('x-tenant-id', 'tenant-acc-inv')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:write')
      .send({
        invoiceId,
        amount: 400,
        method: 'BANK_TRANSFER'
      });

    expect(partialPaymentRes.status).toBe(201);
    expect(partialPaymentRes.body.data.status).toBe('COMPLETED');

    const invPartialCheck = await request(app.getHttpServer())
      .get(`/api/v1/accounting/invoices/${invoiceId}`)
      .set('x-tenant-id', 'tenant-acc-inv')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:read');

    expect(invPartialCheck.body.data.paidAmount).toBe(400);
    expect(invPartialCheck.body.data.status).toBe('PARTIALLY_PAID');

    const fullPaymentRes = await request(app.getHttpServer())
      .post('/api/v1/accounting/payments')
      .set('x-tenant-id', 'tenant-acc-inv')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:write')
      .send({
        invoiceId,
        amount: 600,
        method: 'BANK_TRANSFER'
      });

    expect(fullPaymentRes.status).toBe(201);

    const invFullCheck = await request(app.getHttpServer())
      .get(`/api/v1/accounting/invoices/${invoiceId}`)
      .set('x-tenant-id', 'tenant-acc-inv')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:read');

    expect(invFullCheck.body.data.paidAmount).toBe(1000);
    expect(invFullCheck.body.data.status).toBe('PAID');

    const postPaidPayment = await request(app.getHttpServer())
      .post('/api/v1/accounting/payments')
      .set('x-tenant-id', 'tenant-acc-inv')
      .set('x-actor-id', 'user-acc-1')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:write')
      .send({
        invoiceId,
        amount: 100
      });

    expect(postPaidPayment.status).toBe(400);
  });

  it('should find chart of accounts by id across enterprise', async () => {
    const resA = await request(app.getHttpServer())
      .post('/api/v1/accounting/chart-of-accounts')
      .set('x-actor-id', 'user-acc-A')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:write,accounting:read')
      .send({
        code: '1099',
        name: 'Enterprise Cash',
        type: 'ASSET'
      });

    const accountIdA = resA.body.data.id;

    const getA = await request(app.getHttpServer())
      .get(`/api/v1/accounting/chart-of-accounts/${accountIdA}`)
      .set('x-actor-id', 'user-acc-B')
      .set('x-actor-roles', 'ACCOUNTANT')
      .set('x-actor-permissions', 'accounting:read');

    expect(getA.status).toBe(200);
    expect(getA.body.data.code).toBe('1099');
  });

  it('should enforce RBAC permissions and roles', async () => {
    const unauthRes = await request(app.getHttpServer())
      .post('/api/v1/accounting/chart-of-accounts')
      .set('x-tenant-id', 'tenant-rbac')
      .set('x-actor-id', 'user-emp')
      .set('x-actor-roles', 'EMPLOYEE')
      .set('x-actor-permissions', 'inventory:read')
      .send({
        code: '9999',
        name: 'Unauthorized Account',
        type: 'ASSET'
      });

    expect(unauthRes.status).toBe(403);
  });
});
