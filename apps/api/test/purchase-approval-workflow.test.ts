import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Purchase Approval Workflow Integration Slice', () => {
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
    'x-actor-permissions':
      'procurement:read,procurement:write,procurement:approve,finance:read,finance:write,finance:approve'
  });

  async function setupBudget(app: INestApplication, tenantId: string, totalAmount: number) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/finance/budgets')
      .set(headers(tenantId))
      .send({ name: 'Ops Budget', totalAmount, period: '2026-Q1' });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  }

  async function setupSupplier(
    app: INestApplication,
    tenantId: string,
    verify: boolean
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/procurement/suppliers')
      .set(headers(tenantId))
      .send({ name: 'Acme Supplies', contactEmail: 'sales@acme-supplies.test' });
    expect(res.status).toBe(201);
    const supplierId = res.body.data.id as string;

    if (verify) {
      const verifyRes = await request(app.getHttpServer())
        .patch(`/api/v1/procurement/suppliers/${supplierId}/verify`)
        .set(headers(tenantId));
      expect(verifyRes.status).toBe(200);
    }

    return supplierId;
  }

  async function setupPurchaseOrder(
    app: INestApplication,
    tenantId: string,
    supplierId: string,
    quantity: number,
    unitPrice: number
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/procurement/purchase-orders')
      .set(headers(tenantId))
      .send({
        supplierId,
        items: [{ productId: 'prod-po-1', quantity, unitPrice }]
      });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  }

  it('should auto-approve purchase order when supplier verified, budget available, and amount within threshold', async () => {
    const tenantId = 'tenant-purchase-auto';
    const budgetId = await setupBudget(app, tenantId, 1_000_000);
    const supplierId = await setupSupplier(app, tenantId, true);
    const purchaseOrderId = await setupPurchaseOrder(app, tenantId, supplierId, 10, 1000);

    const res = await request(app.getHttpServer())
      .post('/api/v1/workflows/purchase-approval')
      .set(headers(tenantId))
      .send({ purchaseOrderId, budgetId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.policy.decision).toBe('AUTO_APPROVE');
    expect(res.body.data.purchaseOrderStatus).toBe('APPROVED');

    const poRes = await request(app.getHttpServer())
      .get(`/api/v1/procurement/purchase-orders/${purchaseOrderId}`)
      .set(headers(tenantId));
    expect(poRes.body.data.status).toBe('APPROVED');

    const budgetRes = await request(app.getHttpServer())
      .get(`/api/v1/finance/budgets/${budgetId}`)
      .set(headers(tenantId));
    expect(budgetRes.body.data.allocatedAmount).toBe(10000);
  });

  it('should block purchase order creation when supplier is not verified', async () => {
    const tenantId = 'tenant-purchase-unverified';
    const supplierId = await setupSupplier(app, tenantId, false);

    const res = await request(app.getHttpServer())
      .post('/api/v1/procurement/purchase-orders')
      .set(headers(tenantId))
      .send({
        supplierId,
        items: [{ productId: 'prod-po-1', quantity: 5, unitPrice: 1000 }]
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not verified/i);
  });

  it('should reject purchase order when budget is insufficient', async () => {
    const tenantId = 'tenant-purchase-nobudget';
    const budgetId = await setupBudget(app, tenantId, 100);
    const supplierId = await setupSupplier(app, tenantId, true);
    const purchaseOrderId = await setupPurchaseOrder(app, tenantId, supplierId, 10, 1000);

    const res = await request(app.getHttpServer())
      .post('/api/v1/workflows/purchase-approval')
      .set(headers(tenantId))
      .send({ purchaseOrderId, budgetId });

    expect(res.status).toBe(200);
    expect(res.body.data.policy.decision).toBe('REJECT');
    expect(res.body.data.policy.reasons.join(' ')).toMatch(/budget/i);
  });

  it('should require human approval when amount exceeds auto-approval threshold', async () => {
    const tenantId = 'tenant-purchase-threshold';
    const budgetId = await setupBudget(app, tenantId, 100_000_000);
    const supplierId = await setupSupplier(app, tenantId, true);
    const purchaseOrderId = await setupPurchaseOrder(app, tenantId, supplierId, 100, 100_000);

    const res = await request(app.getHttpServer())
      .post('/api/v1/workflows/purchase-approval')
      .set(headers(tenantId))
      .send({ purchaseOrderId, budgetId, autoApprovalThreshold: 5_000_000 });

    expect(res.status).toBe(200);
    expect(res.body.data.policy.decision).toBe('REQUIRE_HUMAN_APPROVAL');

    const poRes = await request(app.getHttpServer())
      .get(`/api/v1/procurement/purchase-orders/${purchaseOrderId}`)
      .set(headers(tenantId));
    expect(poRes.body.data.status).toBe('DRAFT');
  });

  it('should honor idempotency key and not double-allocate budget', async () => {
    const tenantId = 'tenant-purchase-idempotent';
    const budgetId = await setupBudget(app, tenantId, 1_000_000);
    const supplierId = await setupSupplier(app, tenantId, true);
    const purchaseOrderId = await setupPurchaseOrder(app, tenantId, supplierId, 5, 1000);

    const idempotencyKey = 'purchase-approval-key-1';

    const first = await request(app.getHttpServer())
      .post('/api/v1/workflows/purchase-approval')
      .set(headers(tenantId))
      .send({ purchaseOrderId, budgetId, idempotencyKey });
    expect(first.status).toBe(200);

    const second = await request(app.getHttpServer())
      .post('/api/v1/workflows/purchase-approval')
      .set(headers(tenantId))
      .send({ purchaseOrderId, budgetId, idempotencyKey });
    expect(second.status).toBe(200);

    expect(second.body.data.workflowId).toBe(first.body.data.workflowId);

    const budgetRes = await request(app.getHttpServer())
      .get(`/api/v1/finance/budgets/${budgetId}`)
      .set(headers(tenantId));
    expect(budgetRes.body.data.allocatedAmount).toBe(5000);
  });
});
