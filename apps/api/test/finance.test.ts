import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Finance Module Domain & REST APIs', () => {
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

  it('should create cost center, budget, budget allocation and manage expenses', async () => {
    const ccRes = await request(app.getHttpServer())
      .post('/api/v1/finance/cost-centers')
      .set('x-tenant-id', 'tenant-fin-1')
      .set('x-actor-id', 'user-fin-mgr')
      .set('x-actor-roles', 'FINANCE_MANAGER')
      .set('x-actor-permissions', 'finance:write,finance:read')
      .send({
        name: 'Engineering Cost Center',
        code: 'CC-ENG-01'
      });

    expect(ccRes.status).toBe(201);
    expect(ccRes.body.success).toBe(true);
    expect(ccRes.body.data.code).toBe('CC-ENG-01');
    const costCenterId = ccRes.body.data.id;

    const budgetRes = await request(app.getHttpServer())
      .post('/api/v1/finance/budgets')
      .set('x-tenant-id', 'tenant-fin-1')
      .set('x-actor-id', 'user-fin-mgr')
      .set('x-actor-roles', 'FINANCE_MANAGER')
      .set('x-actor-permissions', 'finance:write,finance:read')
      .send({
        costCenterId,
        name: 'Q3 Cloud Infrastructure Budget',
        totalAmount: 10000,
        period: '2026-Q3'
      });

    expect(budgetRes.status).toBe(201);
    expect(budgetRes.body.success).toBe(true);
    expect(budgetRes.body.data.totalAmount).toBe(10000);
    const budgetId = budgetRes.body.data.id;

    const allocRes = await request(app.getHttpServer())
      .post('/api/v1/finance/budget-allocations')
      .set('x-tenant-id', 'tenant-fin-1')
      .set('x-actor-id', 'user-fin-mgr')
      .set('x-actor-roles', 'FINANCE_MANAGER')
      .set('x-actor-permissions', 'finance:write,finance:read')
      .send({
        budgetId,
        amount: 2000,
        purpose: 'Database Servers'
      });

    expect(allocRes.status).toBe(201);
    expect(allocRes.body.success).toBe(true);
    expect(allocRes.body.data.amount).toBe(2000);

    const expenseRes = await request(app.getHttpServer())
      .post('/api/v1/finance/expenses')
      .set('x-tenant-id', 'tenant-fin-1')
      .set('x-actor-id', 'emp-1')
      .set('x-actor-roles', 'EMPLOYEE')
      .set('x-actor-permissions', 'finance:write')
      .send({
        budgetId,
        costCenterId,
        amount: 1500,
        description: 'Monthly Cloud Subscription',
        requestedBy: 'emp-1'
      });

    expect(expenseRes.status).toBe(201);
    expect(expenseRes.body.success).toBe(true);
    expect(expenseRes.body.data.status).toBe('PENDING');
    const expenseId = expenseRes.body.data.id;

    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/finance/expenses/${expenseId}/approve`)
      .set('x-tenant-id', 'tenant-fin-1')
      .set('x-actor-id', 'user-fin-mgr')
      .set('x-actor-roles', 'FINANCE_MANAGER')
      .set('x-actor-permissions', 'finance:approve')
      .send({
        approvedBy: 'user-fin-mgr'
      });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);
    expect(approveRes.body.data.status).toBe('APPROVED');
    expect(approveRes.body.data.approvedBy).toBe('user-fin-mgr');

    const updatedBudgetRes = await request(app.getHttpServer())
      .get(`/api/v1/finance/budgets/${budgetId}`)
      .set('x-tenant-id', 'tenant-fin-1')
      .set('x-actor-id', 'user-fin-mgr')
      .set('x-actor-roles', 'FINANCE_MANAGER')
      .set('x-actor-permissions', 'finance:read');

    expect(updatedBudgetRes.status).toBe(200);
    expect(updatedBudgetRes.body.data.spentAmount).toBe(1500);
    expect(updatedBudgetRes.body.data.allocatedAmount).toBe(2000);
  });

  it('should enforce checkBudgetAvailability logic on expense approval', async () => {
    const budgetRes = await request(app.getHttpServer())
      .post('/api/v1/finance/budgets')
      .set('x-tenant-id', 'tenant-fin-2')
      .set('x-actor-id', 'user-fin-mgr')
      .set('x-actor-roles', 'FINANCE_MANAGER')
      .set('x-actor-permissions', 'finance:write,finance:read')
      .send({
        name: 'Small Office Budget',
        totalAmount: 1000,
        period: '2026-Q3'
      });

    expect(budgetRes.status).toBe(201);
    const budgetId = budgetRes.body.data.id;

    await request(app.getHttpServer())
      .post('/api/v1/finance/budget-allocations')
      .set('x-tenant-id', 'tenant-fin-2')
      .set('x-actor-id', 'user-fin-mgr')
      .set('x-actor-roles', 'FINANCE_MANAGER')
      .set('x-actor-permissions', 'finance:write')
      .send({
        budgetId,
        amount: 800,
        purpose: 'Office Furniture'
      });

    const expenseRes = await request(app.getHttpServer())
      .post('/api/v1/finance/expenses')
      .set('x-tenant-id', 'tenant-fin-2')
      .set('x-actor-id', 'emp-2')
      .set('x-actor-roles', 'EMPLOYEE')
      .set('x-actor-permissions', 'finance:write')
      .send({
        budgetId,
        amount: 300,
        description: 'Snacks & Coffee',
        requestedBy: 'emp-2'
      });

    expect(expenseRes.status).toBe(201);
    const expenseId = expenseRes.body.data.id;

    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/finance/expenses/${expenseId}/approve`)
      .set('x-tenant-id', 'tenant-fin-2')
      .set('x-actor-id', 'user-fin-mgr')
      .set('x-actor-roles', 'FINANCE_MANAGER')
      .set('x-actor-permissions', 'finance:approve')
      .send({
        approvedBy: 'user-fin-mgr'
      });

    expect(approveRes.status).toBe(400);
  });

  it('should retrieve budgets across enterprise', async () => {
    const budgetRes = await request(app.getHttpServer())
      .post('/api/v1/finance/budgets')
      .set('x-actor-id', 'user-fin-mgr')
      .set('x-actor-roles', 'FINANCE_MANAGER')
      .set('x-actor-permissions', 'finance:write')
      .send({
        name: 'Enterprise Budget',
        totalAmount: 5000,
        period: '2026-Q3'
      });

    expect(budgetRes.status).toBe(201);
    const budgetId = budgetRes.body.data.id;

    const getBudget = await request(app.getHttpServer())
      .get(`/api/v1/finance/budgets/${budgetId}`)
      .set('x-actor-id', 'auditor')
      .set('x-actor-roles', 'FINANCE_MANAGER')
      .set('x-actor-permissions', 'finance:read');

    expect(getBudget.status).toBe(200);
    expect(getBudget.body.data.name).toBe('Enterprise Budget');
  });

  it('should enforce RBAC forbidden without role or permission', async () => {
    const noRoleRes = await request(app.getHttpServer())
      .post('/api/v1/finance/cost-centers')
      .set('x-tenant-id', 'tenant-fin-1')
      .set('x-actor-id', 'user-unknown')
      .set('x-actor-roles', 'EMPLOYEE')
      .set('x-actor-permissions', 'finance:write')
      .send({
        name: 'Unauthorized CC',
        code: 'CC-UNAUTH'
      });

    expect(noRoleRes.status).toBe(403);

    const noPermRes = await request(app.getHttpServer())
      .post('/api/v1/finance/cost-centers')
      .set('x-tenant-id', 'tenant-fin-1')
      .set('x-actor-id', 'user-fin-mgr')
      .set('x-actor-roles', 'FINANCE_MANAGER')
      .set('x-actor-permissions', 'other:permission')
      .send({
        name: 'Unauthorized CC',
        code: 'CC-UNAUTH'
      });

    expect(noPermRes.status).toBe(403);
  });
});
