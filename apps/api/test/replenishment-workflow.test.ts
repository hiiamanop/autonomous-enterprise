import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Inventory Replenishment Integration Slice', () => {
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
      'sales:write,sales:read,inventory:write,inventory:read,procurement:write,procurement:read'
  });

  it('should automatically create a purchase request when stock falls below reorder minimum after fulfillment', async () => {
    const tenantId = 'tenant-replenish-1';

    const custRes = await request(app.getHttpServer())
      .post('/api/v1/sales/customers')
      .set(headers(tenantId))
      .send({ name: 'Replenish Co', email: 'replenish@test.com' });
    const customerId = custRes.body.data.id;

    const prodRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .set(headers(tenantId))
      .send({ sku: 'RPL-001', name: 'Replenish Widget', price: 10 });
    const productId = prodRes.body.data.id;

    const whRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/warehouses')
      .set(headers(tenantId))
      .send({ code: 'WH-RPL', name: 'Replenish Warehouse' });
    const warehouseId = whRes.body.data.id;

    await request(app.getHttpServer())
      .post('/api/v1/inventory/stock')
      .set(headers(tenantId))
      .send({ warehouseId, productId, quantity: 10 });

    await request(app.getHttpServer())
      .post('/api/v1/inventory/reorder-rules')
      .set(headers(tenantId))
      .send({ warehouseId, productId, minQuantity: 5, reorderQuantity: 50 });

    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/sales/orders')
      .set(headers(tenantId))
      .send({
        customerId,
        items: [{ productId, quantity: 8, unitPrice: 10 }]
      });
    const salesOrderId = orderRes.body.data.id;

    const workflowRes = await request(app.getHttpServer())
      .post('/api/v1/workflows/order-fulfillment')
      .set(headers(tenantId))
      .send({ salesOrderId, warehouseId });

    expect(workflowRes.status).toBe(200);
    expect(workflowRes.body.data.status).toBe('COMPLETED');

    const purchaseRequestsRes = await request(app.getHttpServer())
      .get('/api/v1/procurement/purchase-requests')
      .set(headers(tenantId));

    expect(purchaseRequestsRes.status).toBe(200);
    expect(purchaseRequestsRes.body.data.length).toBe(1);
    expect(purchaseRequestsRes.body.data[0].productId).toBe(productId);
    expect(purchaseRequestsRes.body.data[0].quantity).toBe(50);
    expect(purchaseRequestsRes.body.data[0].requestedBy).toBe('AI_INVENTORY_AGENT');
  });

  it('should not create purchase request when stock remains above reorder minimum', async () => {
    const tenantId = 'tenant-replenish-2';

    const custRes = await request(app.getHttpServer())
      .post('/api/v1/sales/customers')
      .set(headers(tenantId))
      .send({ name: 'Stable Co', email: 'stable@test.com' });
    const customerId = custRes.body.data.id;

    const prodRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .set(headers(tenantId))
      .send({ sku: 'STB-001', name: 'Stable Widget', price: 10 });
    const productId = prodRes.body.data.id;

    const whRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/warehouses')
      .set(headers(tenantId))
      .send({ code: 'WH-STB', name: 'Stable Warehouse' });
    const warehouseId = whRes.body.data.id;

    await request(app.getHttpServer())
      .post('/api/v1/inventory/stock')
      .set(headers(tenantId))
      .send({ warehouseId, productId, quantity: 100 });

    await request(app.getHttpServer())
      .post('/api/v1/inventory/reorder-rules')
      .set(headers(tenantId))
      .send({ warehouseId, productId, minQuantity: 5, reorderQuantity: 50 });

    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/sales/orders')
      .set(headers(tenantId))
      .send({
        customerId,
        items: [{ productId, quantity: 8, unitPrice: 10 }]
      });
    const salesOrderId = orderRes.body.data.id;

    await request(app.getHttpServer())
      .post('/api/v1/workflows/order-fulfillment')
      .set(headers(tenantId))
      .send({ salesOrderId, warehouseId });

    const purchaseRequestsRes = await request(app.getHttpServer())
      .get('/api/v1/procurement/purchase-requests')
      .set(headers(tenantId));

    expect(purchaseRequestsRes.status).toBe(200);
    expect(purchaseRequestsRes.body.data.length).toBe(0);
  });
});
