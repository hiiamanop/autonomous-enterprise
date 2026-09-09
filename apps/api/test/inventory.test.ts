import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Inventory Module Domain & REST APIs', () => {
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

  it('should create product, warehouse, set stock, and check availability', async () => {
    const prodRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .set('x-tenant-id', 'tenant-inv-1')
      .set('x-actor-id', 'user-inv-mgr')
      .set('x-actor-roles', 'INVENTORY_MANAGER')
      .set('x-actor-permissions', 'inventory:write,inventory:read')
      .send({
        sku: 'SKU-WIDGET-01',
        name: 'Super Widget',
        description: 'High performance widget',
        price: 49.99
      });

    expect(prodRes.status).toBe(201);
    expect(prodRes.body.success).toBe(true);
    expect(prodRes.body.data.sku).toBe('SKU-WIDGET-01');
    const productId = prodRes.body.data.id;

    const whRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/warehouses')
      .set('x-tenant-id', 'tenant-inv-1')
      .set('x-actor-id', 'user-inv-mgr')
      .set('x-actor-roles', 'INVENTORY_MANAGER')
      .set('x-actor-permissions', 'inventory:write,inventory:read')
      .send({
        code: 'WH-MAIN',
        name: 'Main Distribution Center',
        location: 'Building A'
      });

    expect(whRes.status).toBe(201);
    expect(whRes.body.success).toBe(true);
    const warehouseId = whRes.body.data.id;

    const stockRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/stock')
      .set('x-tenant-id', 'tenant-inv-1')
      .set('x-actor-id', 'user-inv-mgr')
      .set('x-actor-roles', 'INVENTORY_MANAGER')
      .set('x-actor-permissions', 'inventory:write')
      .send({
        warehouseId,
        productId,
        quantity: 100,
        notes: 'Initial stocking'
      });

    expect(stockRes.status).toBe(200);
    expect(stockRes.body.data.quantity).toBe(100);
    expect(stockRes.body.data.availableQuantity).toBe(100);
    expect(stockRes.body.data.reservedQuantity).toBe(0);

    const availRes = await request(app.getHttpServer())
      .get(`/api/v1/inventory/stock/availability?warehouseId=${warehouseId}&productId=${productId}&quantity=50`)
      .set('x-tenant-id', 'tenant-inv-1')
      .set('x-actor-id', 'user-inv-mgr')
      .set('x-actor-roles', 'INVENTORY_MANAGER')
      .set('x-actor-permissions', 'inventory:read');

    expect(availRes.status).toBe(200);
    expect(availRes.body.data.isAvailable).toBe(true);
    expect(availRes.body.data.availableQuantity).toBe(100);
  });

  it('should perform atomic reservation and enforce idempotency key', async () => {
    const prodRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .set('x-tenant-id', 'tenant-inv-2')
      .set('x-actor-id', 'user-inv-mgr')
      .set('x-actor-roles', 'INVENTORY_MANAGER')
      .set('x-actor-permissions', 'inventory:write,inventory:read')
      .send({
        sku: 'SKU-GEAR-01',
        name: 'Precision Gear',
        price: 19.99
      });
    const productId = prodRes.body.data.id;

    const whRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/warehouses')
      .set('x-tenant-id', 'tenant-inv-2')
      .set('x-actor-id', 'user-inv-mgr')
      .set('x-actor-roles', 'INVENTORY_MANAGER')
      .set('x-actor-permissions', 'inventory:write,inventory:read')
      .send({
        code: 'WH-WEST',
        name: 'West Coast Hub'
      });
    const warehouseId = whRes.body.data.id;

    await request(app.getHttpServer())
      .post('/api/v1/inventory/stock')
      .set('x-tenant-id', 'tenant-inv-2')
      .set('x-actor-id', 'user-inv-mgr')
      .set('x-actor-roles', 'INVENTORY_MANAGER')
      .set('x-actor-permissions', 'inventory:write')
      .send({
        warehouseId,
        productId,
        quantity: 20
      });

    const reserveRes1 = await request(app.getHttpServer())
      .post('/api/v1/inventory/reservations')
      .set('x-tenant-id', 'tenant-inv-2')
      .set('x-actor-id', 'user-inv-mgr')
      .set('x-actor-roles', 'INVENTORY_MANAGER')
      .set('x-actor-permissions', 'inventory:write')
      .send({
        warehouseId,
        productId,
        quantity: 15,
        idempotencyKey: 'idem-key-1001'
      });

    expect(reserveRes1.status).toBe(201);
    expect(reserveRes1.body.success).toBe(true);
    expect(reserveRes1.body.data.status).toBe('PENDING');
    const reservationId = reserveRes1.body.data.id;

    const availRes1 = await request(app.getHttpServer())
      .get(`/api/v1/inventory/stock/availability?warehouseId=${warehouseId}&productId=${productId}&quantity=10`)
      .set('x-tenant-id', 'tenant-inv-2')
      .set('x-actor-id', 'user-inv-mgr')
      .set('x-actor-roles', 'INVENTORY_MANAGER')
      .set('x-actor-permissions', 'inventory:read');

    expect(availRes1.body.data.availableQuantity).toBe(5);
    expect(availRes1.body.data.isAvailable).toBe(false);

    const reserveResIdem = await request(app.getHttpServer())
      .post('/api/v1/inventory/reservations')
      .set('x-tenant-id', 'tenant-inv-2')
      .set('x-actor-id', 'user-inv-mgr')
      .set('x-actor-roles', 'INVENTORY_MANAGER')
      .set('x-actor-permissions', 'inventory:write')
      .send({
        warehouseId,
        productId,
        quantity: 15,
        idempotencyKey: 'idem-key-1001'
      });

    expect(reserveResIdem.status).toBe(201);
    expect(reserveResIdem.body.data.id).toBe(reservationId);

    const overReserveRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/reservations')
      .set('x-tenant-id', 'tenant-inv-2')
      .set('x-actor-id', 'user-inv-mgr')
      .set('x-actor-roles', 'INVENTORY_MANAGER')
      .set('x-actor-permissions', 'inventory:write')
      .send({
        warehouseId,
        productId,
        quantity: 10,
        idempotencyKey: 'idem-key-1002'
      });

    expect(overReserveRes.status).toBe(400);
    expect(overReserveRes.body.message).toContain('Insufficient available stock');

    const cancelRes = await request(app.getHttpServer())
      .post(`/api/v1/inventory/reservations/${reservationId}/cancel`)
      .set('x-tenant-id', 'tenant-inv-2')
      .set('x-actor-id', 'user-inv-mgr')
      .set('x-actor-roles', 'INVENTORY_MANAGER')
      .set('x-actor-permissions', 'inventory:write');

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');

    const availRes2 = await request(app.getHttpServer())
      .get(`/api/v1/inventory/stock/availability?warehouseId=${warehouseId}&productId=${productId}&quantity=20`)
      .set('x-tenant-id', 'tenant-inv-2')
      .set('x-actor-id', 'user-inv-mgr')
      .set('x-actor-roles', 'INVENTORY_MANAGER')
      .set('x-actor-permissions', 'inventory:read');

    expect(availRes2.body.data.availableQuantity).toBe(20);
    expect(availRes2.body.data.isAvailable).toBe(true);
  });

  it('should maintain consistent product catalog listing', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .set('x-actor-id', 'user-alpha')
      .set('x-actor-roles', 'ADMIN,TENANT_ADMIN')
      .set('x-actor-permissions', 'inventory:write')
      .send({
        sku: 'SKU-ENTERPRISE-A',
        name: 'Enterprise Product A',
        price: 100
      });

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/inventory/products')
      .set('x-actor-id', 'user-alpha')
      .set('x-actor-roles', 'ADMIN,TENANT_ADMIN')
      .set('x-actor-permissions', 'inventory:read');

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body.data.some((p: any) => p.sku === 'SKU-ENTERPRISE-A')).toBe(true);
  });

  it('should enforce authorization boundaries (roles and permissions)', async () => {
    const unauthRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .set('x-tenant-id', 'tenant-auth')
      .set('x-actor-id', 'user-no-role')
      .set('x-actor-roles', 'GUEST')
      .set('x-actor-permissions', 'inventory:read')
      .send({
        sku: 'SKU-UNAUTH',
        name: 'Unauthorized Product',
        price: 10
      });

    expect(unauthRes.status).toBe(403);
  });

  it('should manage reorder rules and stock movements', async () => {
    const ruleRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/reorder-rules')
      .set('x-tenant-id', 'tenant-rule-1')
      .set('x-actor-id', 'user-mgr')
      .set('x-actor-roles', 'INVENTORY_MANAGER')
      .set('x-actor-permissions', 'inventory:write')
      .send({
        warehouseId: 'wh-123',
        productId: 'prod-456',
        minQuantity: 10,
        reorderQuantity: 50
      });

    expect(ruleRes.status).toBe(201);
    expect(ruleRes.body.data.minQuantity).toBe(10);
    expect(ruleRes.body.data.reorderQuantity).toBe(50);

    const listRules = await request(app.getHttpServer())
      .get('/api/v1/inventory/reorder-rules?warehouseId=wh-123')
      .set('x-tenant-id', 'tenant-rule-1')
      .set('x-actor-id', 'user-mgr')
      .set('x-actor-roles', 'INVENTORY_MANAGER')
      .set('x-actor-permissions', 'inventory:read');

    expect(listRules.status).toBe(200);
    expect(listRules.body.data.length).toBe(1);
  });
});
