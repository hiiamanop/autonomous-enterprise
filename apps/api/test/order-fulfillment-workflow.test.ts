import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuditService } from '../src/common/audit/audit.service';
import { OutboxService } from '../src/modules/workflow/outbox.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';

describe('Order Fulfillment Workflow Integration Slice', () => {
  let app: INestApplication;
  let auditService: AuditService;
  let outboxService: OutboxService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    auditService = app.get(AuditService);
    outboxService = app.get(OutboxService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('should successfully execute workflow: validate sales order -> check inventory -> reserve stock -> return status', async () => {
    const headers = {
      'x-tenant-id': 'tenant-workflow-1',
      'x-actor-id': 'user-admin',
      'x-actor-roles': 'TENANT_ADMIN',
      'x-actor-permissions': 'sales:write,sales:read,inventory:write,inventory:read'
    };

    const custRes = await request(app.getHttpServer())
      .post('/api/v1/sales/customers')
      .set(headers)
      .send({ name: 'Acme Corp', email: 'acme@test.com' });
    expect(custRes.status).toBe(201);
    const customerId = custRes.body.data.id;

    const prodRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .set(headers)
      .send({ sku: 'PROD-001', name: 'Widget A', price: 100 });
    expect(prodRes.status).toBe(201);
    const productId = prodRes.body.data.id;

    const whRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/warehouses')
      .set(headers)
      .send({ code: 'WH-01', name: 'Main Warehouse' });
    expect(whRes.status).toBe(201);
    const warehouseId = whRes.body.data.id;

    const stockRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/stock')
      .set(headers)
      .send({ warehouseId, productId, quantity: 50 });
    expect(stockRes.status).toBe(200);

    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/sales/orders')
      .set(headers)
      .send({
        customerId,
        items: [{ productId, quantity: 10, unitPrice: 100 }]
      });
    expect(orderRes.status).toBe(201);
    const salesOrderId = orderRes.body.data.id;

    const wfRes = await request(app.getHttpServer())
      .post('/api/v1/workflows/order-fulfillment')
      .set(headers)
      .set('x-idempotency-key', 'idemp-wf-1')
      .send({ salesOrderId, warehouseId });

    expect(wfRes.status).toBe(200);
    expect(wfRes.body.success).toBe(true);
    expect(wfRes.body.data.status).toBe('COMPLETED');
    expect(wfRes.body.data.sales.status).toBe('FULFILLED');
    expect(wfRes.body.data.inventory.checked).toBe(true);
    expect(wfRes.body.data.inventory.reserved).toBe(true);
    expect(wfRes.body.data.inventory.reservations.length).toBe(1);

    const getOrderRes = await request(app.getHttpServer())
      .get(`/api/v1/sales/orders/${salesOrderId}`)
      .set(headers);
    expect(getOrderRes.body.data.status).toBe('FULFILLED');

    const auditLogs = auditService.getLogs('tenant-workflow-1');
    const startedAudit = auditLogs.find((l) => l.action === 'WORKFLOW_ORDER_FULFILLMENT_STARTED');
    const successAudit = auditLogs.find((l) => l.action === 'WORKFLOW_ORDER_FULFILLMENT_SUCCESS');
    expect(startedAudit).toBeDefined();
    expect(successAudit).toBeDefined();

    const outboxEvents = outboxService.getEvents('tenant-workflow-1');
    expect(outboxEvents.some((e) => e.eventType === 'OrderFulfillmentStarted')).toBe(true);
    expect(outboxEvents.some((e) => e.eventType === 'OrderFulfilled')).toBe(true);
  });

  it('should fail workflow on insufficient stock and not leave order as fulfilled', async () => {
    const headers = {
      'x-tenant-id': 'tenant-workflow-2',
      'x-actor-id': 'user-admin',
      'x-actor-roles': 'TENANT_ADMIN',
      'x-actor-permissions': 'sales:write,sales:read,inventory:write,inventory:read'
    };

    const custRes = await request(app.getHttpServer())
      .post('/api/v1/sales/customers')
      .set(headers)
      .send({ name: 'Beta Inc', email: 'beta@test.com' });
    const customerId = custRes.body.data.id;

    const prodRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .set(headers)
      .send({ sku: 'PROD-002', name: 'Widget B', price: 200 });
    const productId = prodRes.body.data.id;

    const whRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/warehouses')
      .set(headers)
      .send({ code: 'WH-02', name: 'Secondary Warehouse' });
    const warehouseId = whRes.body.data.id;

    await request(app.getHttpServer())
      .post('/api/v1/inventory/stock')
      .set(headers)
      .send({ warehouseId, productId, quantity: 5 });

    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/sales/orders')
      .set(headers)
      .send({
        customerId,
        items: [{ productId, quantity: 20, unitPrice: 200 }]
      });
    const salesOrderId = orderRes.body.data.id;

    const wfRes = await request(app.getHttpServer())
      .post('/api/v1/workflows/order-fulfillment')
      .set(headers)
      .send({ salesOrderId, warehouseId });

    expect(wfRes.status).toBe(200);
    expect(wfRes.body.success).toBe(false);
    expect(wfRes.body.data.status).toBe('FAILED');
    expect(wfRes.body.data.sales.status).not.toBe('FULFILLED');

    const getOrderRes = await request(app.getHttpServer())
      .get(`/api/v1/sales/orders/${salesOrderId}`)
      .set(headers);
    expect(getOrderRes.body.data.status).not.toBe('FULFILLED');

    const auditLogs = auditService.getLogs('tenant-workflow-2');
    const failedAudit = auditLogs.find((l) => l.action === 'WORKFLOW_ORDER_FULFILLMENT_FAILED');
    expect(failedAudit).toBeDefined();

    const outboxEvents = outboxService.getEvents('tenant-workflow-2');
    expect(outboxEvents.some((e) => e.eventType === 'OrderFulfillmentFailed')).toBe(true);
  });

  it('should respect idempotency key across multiple invocations', async () => {
    const headers = {
      'x-tenant-id': 'tenant-workflow-3',
      'x-actor-id': 'user-admin',
      'x-actor-roles': 'TENANT_ADMIN',
      'x-actor-permissions': 'sales:write,sales:read,inventory:write,inventory:read'
    };

    const custRes = await request(app.getHttpServer())
      .post('/api/v1/sales/customers')
      .set(headers)
      .send({ name: 'Gamma Ltd', email: 'gamma@test.com' });
    const customerId = custRes.body.data.id;

    const prodRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .set(headers)
      .send({ sku: 'PROD-003', name: 'Widget C', price: 50 });
    const productId = prodRes.body.data.id;

    const whRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/warehouses')
      .set(headers)
      .send({ code: 'WH-03', name: 'Tertiary Warehouse' });
    const warehouseId = whRes.body.data.id;

    await request(app.getHttpServer())
      .post('/api/v1/inventory/stock')
      .set(headers)
      .send({ warehouseId, productId, quantity: 100 });

    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/sales/orders')
      .set(headers)
      .send({
        customerId,
        items: [{ productId, quantity: 10, unitPrice: 50 }]
      });
    const salesOrderId = orderRes.body.data.id;

    const firstRes = await request(app.getHttpServer())
      .post('/api/v1/workflows/order-fulfillment')
      .set(headers)
      .set('x-idempotency-key', 'key-idemp-unique-123')
      .send({ salesOrderId, warehouseId });

    expect(firstRes.status).toBe(200);

    const secondRes = await request(app.getHttpServer())
      .post('/api/v1/workflows/order-fulfillment')
      .set(headers)
      .set('x-idempotency-key', 'key-idemp-unique-123')
      .send({ salesOrderId, warehouseId });

    expect(secondRes.status).toBe(200);
    expect(secondRes.body).toEqual(firstRes.body);
  });

  it('should release prior reservation and preserve available stock on multi-item partial reservation failure', async () => {
    const headers = {
      'x-tenant-id': 'tenant-workflow-4',
      'x-actor-id': 'user-admin',
      'x-actor-roles': 'TENANT_ADMIN',
      'x-actor-permissions': 'sales:write,sales:read,inventory:write,inventory:read'
    };

    const custRes = await request(app.getHttpServer())
      .post('/api/v1/sales/customers')
      .set(headers)
      .send({ name: 'Delta Co', email: 'delta@test.com' });
    const customerId = custRes.body.data.id;

    const prod1Res = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .set(headers)
      .send({ sku: 'PROD-MULTI-1', name: 'Item 1', price: 100 });
    const prod1Id = prod1Res.body.data.id;

    const prod2Res = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .set(headers)
      .send({ sku: 'PROD-MULTI-2', name: 'Item 2', price: 150 });
    const prod2Id = prod2Res.body.data.id;

    const whRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/warehouses')
      .set(headers)
      .send({ code: 'WH-04', name: 'Quaternary Warehouse' });
    const warehouseId = whRes.body.data.id;

    await request(app.getHttpServer())
      .post('/api/v1/inventory/stock')
      .set(headers)
      .send({ warehouseId, productId: prod1Id, quantity: 50 });

    await request(app.getHttpServer())
      .post('/api/v1/inventory/stock')
      .set(headers)
      .send({ warehouseId, productId: prod2Id, quantity: 20 });

    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/sales/orders')
      .set(headers)
      .send({
        customerId,
        items: [
          { productId: prod1Id, quantity: 10, unitPrice: 100 },
          { productId: prod2Id, quantity: 5, unitPrice: 150 }
        ]
      });
    const salesOrderId = orderRes.body.data.id;

    const inventoryService = app.get(InventoryService);
    const origReserveStock = inventoryService.reserveStock.bind(inventoryService);
    vi.spyOn(inventoryService, 'reserveStock').mockImplementation(async (dto) => {
      if (dto.productId === prod2Id) {
        throw new Error('Simulated partial reservation failure for second item');
      }
      return origReserveStock(dto);
    });

    const wfRes = await request(app.getHttpServer())
      .post('/api/v1/workflows/order-fulfillment')
      .set(headers)
      .send({ salesOrderId, warehouseId });

    expect(wfRes.status).toBe(200);
    expect(wfRes.body.success).toBe(false);
    expect(wfRes.body.data.status).toBe('FAILED');
    expect(wfRes.body.data.inventory.reserved).toBe(false);

    const avail1Res = await request(app.getHttpServer())
      .get(`/api/v1/inventory/stock/availability?warehouseId=${warehouseId}&productId=${prod1Id}&quantity=10`)
      .set(headers);

    expect(avail1Res.body.data.availableQuantity).toBe(50);
    expect(avail1Res.body.data.isAvailable).toBe(true);
  });
});
