import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { ProcurementController } from '../src/modules/procurement/procurement.controller';
import { ProcurementService } from '../src/modules/procurement/procurement.service';
import { PROCUREMENT_REPOSITORY } from '../src/modules/procurement/domain/procurement.repository.interface';
import { InMemoryProcurementRepository } from '../src/modules/procurement/infrastructure/in-memory-procurement.repository';
import { TenantContextMiddleware } from '../src/common/tenant/tenant-context.middleware';
import { RbacGuard } from '../src/common/auth/rbac.guard';

describe('Procurement Module Domain & REST APIs', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProcurementController],
      providers: [
        ProcurementService,
        {
          provide: PROCUREMENT_REPOSITORY,
          useClass: InMemoryProcurementRepository
        },
        {
          provide: APP_GUARD,
          useClass: RbacGuard
        }
      ]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(new TenantContextMiddleware().use);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should create supplier with isVerified=false and allow verification', async () => {
    const supRes = await request(app.getHttpServer())
      .post('/api/v1/procurement/suppliers')
      .set('x-tenant-id', 'tenant-proc-1')
      .set('x-actor-id', 'user-proc-mgr')
      .set('x-actor-roles', 'PROCUREMENT_MANAGER')
      .set('x-actor-permissions', 'procurement:write')
      .send({
        name: 'Acme Supply Co',
        contactEmail: 'supplier@acme.com',
        contactPhone: '+1-555-0199'
      });

    expect(supRes.status).toBe(201);
    expect(supRes.body.success).toBe(true);
    expect(supRes.body.data.isVerified).toBe(false);
    expect(supRes.body.data.name).toBe('Acme Supply Co');
    const supplierId = supRes.body.data.id;

    const verifyRes = await request(app.getHttpServer())
      .patch(`/api/v1/procurement/suppliers/${supplierId}/verify`)
      .set('x-tenant-id', 'tenant-proc-1')
      .set('x-actor-id', 'user-proc-mgr')
      .set('x-actor-roles', 'PROCUREMENT_MANAGER')
      .set('x-actor-permissions', 'procurement:write');

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.data.isVerified).toBe(true);
  });

  it('should fail to create purchase order if supplier is not verified', async () => {
    const supRes = await request(app.getHttpServer())
      .post('/api/v1/procurement/suppliers')
      .set('x-tenant-id', 'tenant-proc-2')
      .set('x-actor-id', 'user-proc-mgr')
      .set('x-actor-roles', 'PROCUREMENT_MANAGER')
      .set('x-actor-permissions', 'procurement:write')
      .send({
        name: 'Unverified Vendor',
        contactEmail: 'vendor@unverified.com'
      });

    expect(supRes.status).toBe(201);
    const supplierId = supRes.body.data.id;

    const poRes = await request(app.getHttpServer())
      .post('/api/v1/procurement/purchase-orders')
      .set('x-tenant-id', 'tenant-proc-2')
      .set('x-actor-id', 'user-proc-mgr')
      .set('x-actor-roles', 'PROCUREMENT_MANAGER')
      .set('x-actor-permissions', 'procurement:write')
      .send({
        supplierId,
        items: [
          {
            productId: 'prod-101',
            quantity: 5,
            unitPrice: 20
          }
        ]
      });

    expect(poRes.status).toBe(400);
    expect(poRes.body.message).toContain('Supplier is not verified');
  });

  it('should successfully create purchase order after supplier is verified, approve it, and receive goods', async () => {
    const supRes = await request(app.getHttpServer())
      .post('/api/v1/procurement/suppliers')
      .set('x-tenant-id', 'tenant-proc-3')
      .set('x-actor-id', 'user-proc-mgr')
      .set('x-actor-roles', 'PROCUREMENT_MANAGER')
      .set('x-actor-permissions', 'procurement:write')
      .send({
        name: 'Reliable Parts Ltd'
      });

    const supplierId = supRes.body.data.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/procurement/suppliers/${supplierId}/verify`)
      .set('x-tenant-id', 'tenant-proc-3')
      .set('x-actor-id', 'user-proc-mgr')
      .set('x-actor-roles', 'PROCUREMENT_MANAGER')
      .set('x-actor-permissions', 'procurement:write');

    const poRes = await request(app.getHttpServer())
      .post('/api/v1/procurement/purchase-orders')
      .set('x-tenant-id', 'tenant-proc-3')
      .set('x-actor-id', 'user-proc-mgr')
      .set('x-actor-roles', 'PROCUREMENT_MANAGER')
      .set('x-actor-permissions', 'procurement:write')
      .send({
        supplierId,
        idempotencyKey: 'po-idem-001',
        items: [
          {
            productId: 'prod-item-1',
            quantity: 10,
            unitPrice: 25.5
          },
          {
            productId: 'prod-item-2',
            quantity: 2,
            unitPrice: 50.0
          }
        ]
      });

    expect(poRes.status).toBe(201);
    expect(poRes.body.success).toBe(true);
    expect(poRes.body.data.status).toBe('DRAFT');
    expect(poRes.body.data.totalAmount).toBe(355.0);
    const purchaseOrderId = poRes.body.data.id;

    const poIdemRes = await request(app.getHttpServer())
      .post('/api/v1/procurement/purchase-orders')
      .set('x-tenant-id', 'tenant-proc-3')
      .set('x-actor-id', 'user-proc-mgr')
      .set('x-actor-roles', 'PROCUREMENT_MANAGER')
      .set('x-actor-permissions', 'procurement:write')
      .send({
        supplierId,
        idempotencyKey: 'po-idem-001',
        items: []
      });

    expect(poIdemRes.status).toBe(201);
    expect(poIdemRes.body.data.id).toBe(purchaseOrderId);

    const approveRes = await request(app.getHttpServer())
      .patch(`/api/v1/procurement/purchase-orders/${purchaseOrderId}/approve`)
      .set('x-tenant-id', 'tenant-proc-3')
      .set('x-actor-id', 'user-proc-mgr')
      .set('x-actor-roles', 'PROCUREMENT_MANAGER')
      .set('x-actor-permissions', 'procurement:approve');

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('APPROVED');

    const grRes = await request(app.getHttpServer())
      .post('/api/v1/procurement/goods-receipts')
      .set('x-tenant-id', 'tenant-proc-3')
      .set('x-actor-id', 'user-proc-mgr')
      .set('x-actor-roles', 'PROCUREMENT_MANAGER')
      .set('x-actor-permissions', 'procurement:write')
      .send({
        purchaseOrderId,
        receivedQuantity: 12,
        warehouseId: 'wh-main'
      });

    expect(grRes.status).toBe(201);
    expect(grRes.body.success).toBe(true);

    const checkPoRes = await request(app.getHttpServer())
      .get(`/api/v1/procurement/purchase-orders/${purchaseOrderId}`)
      .set('x-tenant-id', 'tenant-proc-3')
      .set('x-actor-id', 'user-proc-mgr')
      .set('x-actor-roles', 'PROCUREMENT_MANAGER')
      .set('x-actor-permissions', 'procurement:read');

    expect(checkPoRes.status).toBe(200);
    expect(checkPoRes.body.data.status).toBe('RECEIVED');
  });

  it('should retrieve suppliers across enterprise', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/procurement/suppliers')
      .set('x-actor-id', 'user-alpha')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'procurement:write')
      .send({
        name: 'Supplier Enterprise Alpha'
      });

    const listSuppliers = await request(app.getHttpServer())
      .get('/api/v1/procurement/suppliers')
      .set('x-actor-id', 'user-beta')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'procurement:read');

    expect(listSuppliers.status).toBe(200);
    expect(listSuppliers.body.data.some((s: any) => s.name === 'Supplier Enterprise Alpha')).toBe(true);
  });

  it('should enforce RBAC forbidden when role or permission is missing', async () => {
    const unauthRes = await request(app.getHttpServer())
      .post('/api/v1/procurement/suppliers')
      .set('x-tenant-id', 'tenant-auth')
      .set('x-actor-id', 'user-guest')
      .set('x-actor-roles', 'EMPLOYEE')
      .set('x-actor-permissions', 'procurement:read')
      .send({
        name: 'Unauthorized Supplier Attempt'
      });

    expect(unauthRes.status).toBe(403);
  });
});
