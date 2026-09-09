import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Overtime Approval Workflow Integration Slice', () => {
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
    'x-actor-id': 'user-hr-admin',
    'x-actor-roles': 'TENANT_ADMIN',
    'x-actor-permissions':
      'hris:read,hris:write,finance:read,finance:write,ticketing:read,ticketing:write'
  });

  async function setupEmployee(tenantId: string, hourlyRate: number) {
    const deptRes = await request(app.getHttpServer())
      .post('/api/v1/hris/departments')
      .set(headers(tenantId))
      .send({ name: 'Warehouse Ops' });

    const empRes = await request(app.getHttpServer())
      .post('/api/v1/hris/employees')
      .set(headers(tenantId))
      .send({
        departmentId: deptRes.body.data.id,
        fullName: 'Budi Santoso',
        email: 'budi@example.com',
        position: 'Warehouse Staff',
        hourlyRate
      });

    return empRes.body.data.id as string;
  }

  it('should auto-approve overtime when HRIS and Finance agree (low cost, no budget)', async () => {
    const tenantId = 'tenant-ot-agree';
    const employeeId = await setupEmployee(tenantId, 20);

    const overtimeRes = await request(app.getHttpServer())
      .post('/api/v1/hris/overtime')
      .set(headers(tenantId))
      .send({ employeeId, date: '2026-09-01', hours: 2, reason: 'Order surge' });

    expect(overtimeRes.status).toBe(201);
    expect(overtimeRes.body.data.estimatedCost).toBeCloseTo(20 * 2 * 1.5, 2);

    const approvalRes = await request(app.getHttpServer())
      .post('/api/v1/workflows/overtime-approval')
      .set(headers(tenantId))
      .send({ overtimeRequestId: overtimeRes.body.data.id, employeeId });

    expect(approvalRes.status).toBe(200);
    expect(approvalRes.body.data.hrisDecision).toBe('OVERTIME_REQUIRED');
    expect(approvalRes.body.data.financeDecision).toBe('OVERTIME_REQUIRED');
    expect(approvalRes.body.data.resolved).toBe(true);
    expect(approvalRes.body.data.escalated).toBe(false);
    expect(approvalRes.body.data.overtimeStatus).toBe('APPROVED');

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/hris/overtime/employee/${employeeId}`)
      .set(headers(tenantId));
    expect(listRes.body.data[0].status).toBe('APPROVED');
  });

  it('should escalate to human review when HRIS and Finance disagree with equal trust', async () => {
    const tenantId = 'tenant-ot-conflict';
    const employeeId = await setupEmployee(tenantId, 100);

    const overtimeRes = await request(app.getHttpServer())
      .post('/api/v1/hris/overtime')
      .set(headers(tenantId))
      .send({ employeeId, date: '2026-09-01', hours: 5, reason: 'Critical incident response' });

    expect(overtimeRes.body.data.estimatedCost).toBeCloseTo(100 * 5 * 1.5, 2);
    expect(overtimeRes.body.data.estimatedCost).toBeGreaterThan(200);

    const approvalRes = await request(app.getHttpServer())
      .post('/api/v1/workflows/overtime-approval')
      .set(headers(tenantId))
      .send({ overtimeRequestId: overtimeRes.body.data.id, employeeId });

    expect(approvalRes.status).toBe(200);
    expect(approvalRes.body.data.hrisDecision).toBe('OVERTIME_REQUIRED');
    expect(approvalRes.body.data.financeDecision).toBe('OVERTIME_NOT_JUSTIFIED');
    expect(approvalRes.body.data.resolved).toBe(false);
    expect(approvalRes.body.data.escalated).toBe(true);
    expect(approvalRes.body.data.ticketId).toBeDefined();
    expect(approvalRes.body.data.overtimeStatus).toBe('REQUESTED');

    const ticketRes = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${approvalRes.body.data.ticketId}`)
      .set(headers(tenantId));
    expect(ticketRes.status).toBe(200);
    expect(ticketRes.body.data.source).toBe('AgentConflictDetected');
  });

  it('should reject overtime when linked budget has insufficient funds', async () => {
    const tenantId = 'tenant-ot-budget';
    const employeeId = await setupEmployee(tenantId, 20);

    const costCenterRes = await request(app.getHttpServer())
      .post('/api/v1/finance/cost-centers')
      .set(headers(tenantId))
      .send({ name: 'Warehouse Ops CC', code: 'WH-CC' });

    const budgetRes = await request(app.getHttpServer())
      .post('/api/v1/finance/budgets')
      .set(headers(tenantId))
      .send({
        costCenterId: costCenterRes.body.data.id,
        name: 'Overtime Budget',
        totalAmount: 10,
        period: '2026-Q3'
      });

    const overtimeRes = await request(app.getHttpServer())
      .post('/api/v1/hris/overtime')
      .set(headers(tenantId))
      .send({ employeeId, date: '2026-09-01', hours: 2, reason: 'Order surge' });

    const approvalRes = await request(app.getHttpServer())
      .post('/api/v1/workflows/overtime-approval')
      .set(headers(tenantId))
      .send({
        overtimeRequestId: overtimeRes.body.data.id,
        employeeId,
        budgetId: budgetRes.body.data.id
      });

    expect(approvalRes.status).toBe(200);
    expect(approvalRes.body.data.financeDecision).toBe('OVERTIME_NOT_JUSTIFIED');
    expect(approvalRes.body.data.resolved).toBe(false);
    expect(approvalRes.body.data.escalated).toBe(true);
  });
});
