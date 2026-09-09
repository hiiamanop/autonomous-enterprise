import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Sales Module Domain & APIs', () => {
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

  it('should create and retrieve customers across the enterprise', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/sales/customers')
      .set('x-tenant-id', 'tenant-a')
      .set('x-actor-id', 'user-sales-1')
      .set('x-actor-roles', 'SALES_MANAGER')
      .set('x-actor-permissions', 'sales:write,sales:read')
      .send({
        name: 'Acme Corp',
        email: 'contact@acme.com',
        phone: '123456789'
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.name).toBe('Acme Corp');
    const customerId = createRes.body.data.id;

    const listTenantA = await request(app.getHttpServer())
      .get('/api/v1/sales/customers')
      .set('x-tenant-id', 'tenant-a')
      .set('x-actor-id', 'user-sales-1')
      .set('x-actor-roles', 'SALES_MANAGER')
      .set('x-actor-permissions', 'sales:read');

    expect(listTenantA.status).toBe(200);
    expect(listTenantA.body.data.length).toBe(1);

    const listAgain = await request(app.getHttpServer())
      .get('/api/v1/sales/customers')
      .set('x-actor-id', 'user-sales-2')
      .set('x-actor-roles', 'SALES_MANAGER')
      .set('x-actor-permissions', 'sales:read');

    expect(listAgain.status).toBe(200);
    expect(listAgain.body.data.length).toBe(1);

    const getCustomer = await request(app.getHttpServer())
      .get(`/api/v1/sales/customers/${customerId}`)
      .set('x-actor-id', 'user-sales-2')
      .set('x-actor-roles', 'SALES_MANAGER')
      .set('x-actor-permissions', 'sales:read');

    expect(getCustomer.status).toBe(200);
    expect(getCustomer.body.data.name).toBe('Acme Corp');
  });

  it('should create sales order with accurate pricing and discounts', async () => {
    const custRes = await request(app.getHttpServer())
      .post('/api/v1/sales/customers')
      .set('x-tenant-id', 'tenant-a')
      .set('x-actor-id', 'user-sales-1')
      .set('x-actor-roles', 'SALES_MANAGER')
      .set('x-actor-permissions', 'sales:write,sales:read')
      .send({
        name: 'Stark Industries',
        email: 'info@stark.com'
      });

    const customerId = custRes.body.data.id;

    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/sales/orders')
      .set('x-tenant-id', 'tenant-a')
      .set('x-actor-id', 'user-sales-1')
      .set('x-actor-roles', 'SALES_MANAGER')
      .set('x-actor-permissions', 'sales:write,sales:read')
      .send({
        customerId,
        items: [
          { productId: 'prod-1', quantity: 2, unitPrice: 50, discount: 10 },
          { productId: 'prod-2', quantity: 1, unitPrice: 100, discount: 0 }
        ],
        discountAmount: 15,
        notes: 'Priority delivery'
      });

    expect(orderRes.status).toBe(201);
    expect(orderRes.body.success).toBe(true);
    const order = orderRes.body.data;
    expect(order.subtotal).toBe(200);
    expect(order.discountAmount).toBe(25);
    expect(order.totalAmount).toBe(175);
    expect(order.status).toBe('DRAFT');
  });

  it('should handle idempotency key correctly', async () => {
    const custRes = await request(app.getHttpServer())
      .post('/api/v1/sales/customers')
      .set('x-tenant-id', 'tenant-a')
      .set('x-actor-id', 'user-sales-1')
      .set('x-actor-roles', 'SALES_MANAGER')
      .set('x-actor-permissions', 'sales:write')
      .send({ name: 'Wayne Enterprises', email: 'bruce@wayne.com' });

    const customerId = custRes.body.data.id;
    const idempotencyKey = 'idem-key-999';

    const order1 = await request(app.getHttpServer())
      .post('/api/v1/sales/orders')
      .set('x-tenant-id', 'tenant-a')
      .set('x-actor-id', 'user-sales-1')
      .set('x-actor-roles', 'SALES_MANAGER')
      .set('x-actor-permissions', 'sales:write')
      .set('x-idempotency-key', idempotencyKey)
      .send({
        customerId,
        items: [{ productId: 'prod-1', quantity: 1, unitPrice: 100 }]
      });

    const order2 = await request(app.getHttpServer())
      .post('/api/v1/sales/orders')
      .set('x-tenant-id', 'tenant-a')
      .set('x-actor-id', 'user-sales-1')
      .set('x-actor-roles', 'SALES_MANAGER')
      .set('x-actor-permissions', 'sales:write')
      .set('x-idempotency-key', idempotencyKey)
      .send({
        customerId,
        items: [{ productId: 'prod-1', quantity: 1, unitPrice: 100 }]
      });

    expect(order1.status).toBe(201);
    expect(order2.status).toBe(201);
    expect(order1.body.data.id).toBe(order2.body.data.id);
  });

  it('should validate status transitions and enforce RBAC', async () => {
    const custRes = await request(app.getHttpServer())
      .post('/api/v1/sales/customers')
      .set('x-tenant-id', 'tenant-a')
      .set('x-actor-id', 'user-sales-1')
      .set('x-actor-roles', 'SALES_MANAGER')
      .set('x-actor-permissions', 'sales:write')
      .send({ name: 'Cyberdyne', email: 'arnold@cyberdyne.com' });

    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/sales/orders')
      .set('x-tenant-id', 'tenant-a')
      .set('x-actor-id', 'user-sales-1')
      .set('x-actor-roles', 'SALES_MANAGER')
      .set('x-actor-permissions', 'sales:write')
      .send({
        customerId: custRes.body.data.id,
        items: [{ productId: 'prod-1', quantity: 1, unitPrice: 50 }]
      });

    const orderId = orderRes.body.data.id;

    const rbacFail = await request(app.getHttpServer())
      .patch(`/api/v1/sales/orders/${orderId}/status`)
      .set('x-tenant-id', 'tenant-a')
      .set('x-actor-id', 'employee-1')
      .set('x-actor-roles', 'EMPLOYEE')
      .set('x-actor-permissions', 'sales:read')
      .send({ status: 'APPROVED' });

    expect(rbacFail.status).toBe(403);

    const approveRes = await request(app.getHttpServer())
      .patch(`/api/v1/sales/orders/${orderId}/status`)
      .set('x-tenant-id', 'tenant-a')
      .set('x-actor-id', 'user-sales-1')
      .set('x-actor-roles', 'SALES_MANAGER')
      .set('x-actor-permissions', 'sales:approve')
      .send({ status: 'APPROVED' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('APPROVED');

    const fulfillRes = await request(app.getHttpServer())
      .patch(`/api/v1/sales/orders/${orderId}/status`)
      .set('x-tenant-id', 'tenant-a')
      .set('x-actor-id', 'user-sales-1')
      .set('x-actor-roles', 'SALES_MANAGER')
      .set('x-actor-permissions', 'sales:approve')
      .send({ status: 'FULFILLED' });

    expect(fulfillRes.status).toBe(200);
    expect(fulfillRes.body.data.status).toBe('FULFILLED');

    const invalidTransition = await request(app.getHttpServer())
      .patch(`/api/v1/sales/orders/${orderId}/status`)
      .set('x-tenant-id', 'tenant-a')
      .set('x-actor-id', 'user-sales-1')
      .set('x-actor-roles', 'SALES_MANAGER')
      .set('x-actor-permissions', 'sales:approve')
      .send({ status: 'CANCELLED' });

    expect(invalidTransition.status).toBe(400);
  });
});
