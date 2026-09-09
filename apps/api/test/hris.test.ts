import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { HrisController } from '../src/modules/hris/hris.controller';
import { HrisService } from '../src/modules/hris/hris.service';
import { HRIS_REPOSITORY } from '../src/modules/hris/domain/hris.repository.interface';
import { InMemoryHrisRepository } from '../src/modules/hris/infrastructure/in-memory-hris.repository';
import { AuditService } from '../src/common/audit/audit.service';
import { TenantContextMiddleware } from '../src/common/tenant/tenant-context.middleware';
import { RbacGuard } from '../src/common/auth/rbac.guard';

describe('HRIS Module Domain & REST APIs', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HrisController],
      providers: [
        HrisService,
        AuditService,
        {
          provide: HRIS_REPOSITORY,
          useClass: InMemoryHrisRepository
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

  it('should create and retrieve enterprise departments', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/hris/departments')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write,hris:read')
      .send({
        name: 'Engineering'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Engineering');
    expect(res.body.data.id).toBeDefined();

    const deptId = res.body.data.id;

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/hris/departments')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:read');

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.length).toBe(1);

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/hris/departments/${deptId}`)
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:read');

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.name).toBe('Engineering');
  });

  it('should retrieve departments across the enterprise', async () => {
    const deptRes = await request(app.getHttpServer())
      .post('/api/v1/hris/departments')
      .set('x-tenant-id', 'tenant-hr-alpha')
      .set('x-actor-id', 'user-alpha')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write,hris:read')
      .send({ name: 'Alpha Dept' });

    const deptId = deptRes.body.data.id;

    const enterpriseRes = await request(app.getHttpServer())
      .get(`/api/v1/hris/departments/${deptId}`)
      .set('x-actor-id', 'user-beta')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:read');

    expect(enterpriseRes.status).toBe(200);

    const enterpriseListRes = await request(app.getHttpServer())
      .get('/api/v1/hris/departments')
      .set('x-actor-id', 'user-beta')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:read');

    expect(enterpriseListRes.body.data.some((d: any) => d.id === deptId)).toBe(true);
  });

  it('should create, update, and get employees', async () => {
    const deptRes = await request(app.getHttpServer())
      .post('/api/v1/hris/departments')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write,hris:read')
      .send({ name: 'Product' });

    const deptId = deptRes.body.data.id;

    const empRes = await request(app.getHttpServer())
      .post('/api/v1/hris/employees')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write,hris:read')
      .send({
        departmentId: deptId,
        fullName: 'Alice Smith',
        email: 'alice@example.com',
        position: 'Product Designer',
        hourlyRate: 50
      });

    expect(empRes.status).toBe(201);
    expect(empRes.body.success).toBe(true);
    expect(empRes.body.data.fullName).toBe('Alice Smith');
    expect(empRes.body.data.status).toBe('ACTIVE');
    const empId = empRes.body.data.id;

    const updateRes = await request(app.getHttpServer())
      .patch(`/api/v1/hris/employees/${empId}`)
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write,hris:read')
      .send({
        position: 'Lead Product Designer',
        hourlyRate: 65
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.position).toBe('Lead Product Designer');
    expect(updateRes.body.data.hourlyRate).toBe(65);

    const getEmpRes = await request(app.getHttpServer())
      .get(`/api/v1/hris/employees/${empId}`)
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:read');

    expect(getEmpRes.status).toBe(200);
    expect(getEmpRes.body.data.position).toBe('Lead Product Designer');
  });

  it('should reject employee creation with non-existent department', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/hris/employees')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write,hris:read')
      .send({
        departmentId: 'invalid-dept-id',
        fullName: 'Ghost Worker',
        email: 'ghost@example.com',
        position: 'Tester',
        hourlyRate: 30
      });

    expect(res.status).toBe(404);
  });

  it('should record attendance and clock out', async () => {
    const deptRes = await request(app.getHttpServer())
      .post('/api/v1/hris/departments')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write,hris:read')
      .send({ name: 'Operations' });

    const empRes = await request(app.getHttpServer())
      .post('/api/v1/hris/employees')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write,hris:read')
      .send({
        departmentId: deptRes.body.data.id,
        fullName: 'Bob Johnson',
        email: 'bob@example.com',
        position: 'Operator',
        hourlyRate: 25
      });

    const empId = empRes.body.data.id;

    const attRes = await request(app.getHttpServer())
      .post('/api/v1/hris/attendance')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-operator')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'hris:write')
      .send({
        employeeId: empId,
        date: '2026-09-02'
      });

    expect(attRes.status).toBe(201);
    expect(attRes.body.success).toBe(true);
    expect(attRes.body.data.status).toBe('PRESENT');
    expect(attRes.body.data.clockIn).toBeDefined();
    const attId = attRes.body.data.id;

    const clockOutRes = await request(app.getHttpServer())
      .post(`/api/v1/hris/attendance/${attId}/clock-out`)
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-operator')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'hris:write');

    expect(clockOutRes.status).toBe(201);
    expect(clockOutRes.body.data.clockOut).toBeDefined();

    const listAttRes = await request(app.getHttpServer())
      .get(`/api/v1/hris/attendance/employee/${empId}`)
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:read');

    expect(listAttRes.status).toBe(200);
    expect(listAttRes.body.data.length).toBe(1);
  });

  it('should handle leave request, approve, and reject workflow', async () => {
    const deptRes = await request(app.getHttpServer())
      .post('/api/v1/hris/departments')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write,hris:read')
      .send({ name: 'Finance' });

    const empRes = await request(app.getHttpServer())
      .post('/api/v1/hris/employees')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write,hris:read')
      .send({
        departmentId: deptRes.body.data.id,
        fullName: 'Charlie Brown',
        email: 'charlie@example.com',
        position: 'Accountant',
        hourlyRate: 35
      });

    const empId = empRes.body.data.id;

    const leave1Res = await request(app.getHttpServer())
      .post('/api/v1/hris/leaves')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-operator')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'hris:write')
      .send({
        employeeId: empId,
        type: 'ANNUAL',
        startDate: '2026-10-01',
        endDate: '2026-10-05',
        reason: 'Family Vacation'
      });

    expect(leave1Res.status).toBe(201);
    expect(leave1Res.body.data.status).toBe('PENDING');
    const leave1Id = leave1Res.body.data.id;

    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/hris/leaves/${leave1Id}/approve`)
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write');

    expect(approveRes.status).toBe(201);
    expect(approveRes.body.data.status).toBe('APPROVED');

    const leave2Res = await request(app.getHttpServer())
      .post('/api/v1/hris/leaves')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-operator')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'hris:write')
      .send({
        employeeId: empId,
        type: 'UNPAID',
        startDate: '2026-11-01',
        endDate: '2026-11-03'
      });

    const leave2Id = leave2Res.body.data.id;

    const rejectRes = await request(app.getHttpServer())
      .post(`/api/v1/hris/leaves/${leave2Id}/reject`)
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write');

    expect(rejectRes.status).toBe(201);
    expect(rejectRes.body.data.status).toBe('REJECTED');

    const listLeavesRes = await request(app.getHttpServer())
      .get(`/api/v1/hris/leaves/employee/${empId}`)
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:read');

    expect(listLeavesRes.status).toBe(200);
    expect(listLeavesRes.body.data.length).toBe(2);
  });

  it('should request overtime with estimatedCost = hourlyRate * hours * 1.5', async () => {
    const deptRes = await request(app.getHttpServer())
      .post('/api/v1/hris/departments')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write,hris:read')
      .send({ name: 'Logistics' });

    const empRes = await request(app.getHttpServer())
      .post('/api/v1/hris/employees')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write,hris:read')
      .send({
        departmentId: deptRes.body.data.id,
        fullName: 'Dave Miller',
        email: 'dave@example.com',
        position: 'Warehouse Lead',
        hourlyRate: 40
      });

    const empId = empRes.body.data.id;

    // 4 hours overtime for rate 40 -> 40 * 4 * 1.5 = 240
    const otRes = await request(app.getHttpServer())
      .post('/api/v1/hris/overtime')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-ai-orch')
      .set('x-actor-roles', 'AI_ORCHESTRATOR')
      .set('x-actor-permissions', 'hris:write')
      .send({
        employeeId: empId,
        date: '2026-09-02',
        hours: 4,
        reason: 'Peak load handling'
      });

    expect(otRes.status).toBe(201);
    expect(otRes.body.success).toBe(true);
    expect(otRes.body.data.status).toBe('REQUESTED');
    expect(otRes.body.data.estimatedCost).toBe(240);
    const otId = otRes.body.data.id;

    const approveOtRes = await request(app.getHttpServer())
      .post(`/api/v1/hris/overtime/${otId}/approve`)
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write');

    expect(approveOtRes.status).toBe(201);
    expect(approveOtRes.body.data.status).toBe('APPROVED');

    const ot2Res = await request(app.getHttpServer())
      .post('/api/v1/hris/overtime')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-operator')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'hris:write')
      .send({
        employeeId: empId,
        date: '2026-09-03',
        hours: 2,
        reason: 'Late shipment'
      });

    expect(ot2Res.body.data.estimatedCost).toBe(120); // 40 * 2 * 1.5 = 120

    const rejectOtRes = await request(app.getHttpServer())
      .post(`/api/v1/hris/overtime/${ot2Res.body.data.id}/reject`)
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write');

    expect(rejectOtRes.status).toBe(201);
    expect(rejectOtRes.body.data.status).toBe('REJECTED');

    const listOtRes = await request(app.getHttpServer())
      .get(`/api/v1/hris/overtime/employee/${empId}`)
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:read');

    expect(listOtRes.status).toBe(200);
    expect(listOtRes.body.data.length).toBe(2);
  });

  it('should calculate workload summary and detect overload correctly', async () => {
    const deptRes = await request(app.getHttpServer())
      .post('/api/v1/hris/departments')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write,hris:read')
      .send({ name: 'Support' });

    const deptId = deptRes.body.data.id;

    // Create 2 employees -> overload threshold = 2 * 10 = 20 hours
    const emp1Res = await request(app.getHttpServer())
      .post('/api/v1/hris/employees')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write,hris:read')
      .send({
        departmentId: deptId,
        fullName: 'Support Rep 1',
        email: 'rep1@example.com',
        position: 'Agent',
        hourlyRate: 30
      });

    const emp2Res = await request(app.getHttpServer())
      .post('/api/v1/hris/employees')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write,hris:read')
      .send({
        departmentId: deptId,
        fullName: 'Support Rep 2',
        email: 'rep2@example.com',
        position: 'Agent',
        hourlyRate: 30
      });

    const emp1Id = emp1Res.body.data.id;
    const emp2Id = emp2Res.body.data.id;

    // Add 15 hours overtime for emp1 (15 <= 20 threshold -> not overloaded)
    await request(app.getHttpServer())
      .post('/api/v1/hris/overtime')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write')
      .send({
        employeeId: emp1Id,
        date: new Date().toISOString(),
        hours: 15
      });

    const workload1Res = await request(app.getHttpServer())
      .get(`/api/v1/hris/departments/${deptId}/workload`)
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-ai-orch')
      .set('x-actor-roles', 'AI_ORCHESTRATOR')
      .set('x-actor-permissions', 'hris:read');

    expect(workload1Res.status).toBe(200);
    expect(workload1Res.body.data.employeeCount).toBe(2);
    expect(workload1Res.body.data.totalOvertimeHoursLast30Days).toBe(15);
    expect(workload1Res.body.data.openTicketCount).toBe(0);
    expect(workload1Res.body.data.isOverloaded).toBe(false);

    // Add 10 hours overtime for emp2 (total 25 hours > 20 threshold -> overloaded)
    await request(app.getHttpServer())
      .post('/api/v1/hris/overtime')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:write')
      .send({
        employeeId: emp2Id,
        date: new Date().toISOString(),
        hours: 10
      });

    const workload2Res = await request(app.getHttpServer())
      .get(`/api/v1/hris/departments/${deptId}/workload`)
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-ai-orch')
      .set('x-actor-roles', 'AI_ORCHESTRATOR')
      .set('x-actor-permissions', 'hris:read');

    expect(workload2Res.status).toBe(200);
    expect(workload2Res.body.data.employeeCount).toBe(2);
    expect(workload2Res.body.data.totalOvertimeHoursLast30Days).toBe(25);
    expect(workload2Res.body.data.isOverloaded).toBe(true);
    expect(workload2Res.body.data.reasons.length).toBeGreaterThan(0);
  });

  it('should enforce RBAC permissions and reject forbidden roles/permissions', async () => {
    // Attempt write without hris:write permission
    const noPermRes = await request(app.getHttpServer())
      .post('/api/v1/hris/departments')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-viewer')
      .set('x-actor-roles', 'AUDITOR')
      .set('x-actor-permissions', 'hris:read')
      .send({ name: 'Unauthorized Dept' });

    expect(noPermRes.status).toBe(403);

    // Attempt write with role not in allowed roles
    const forbiddenRoleRes = await request(app.getHttpServer())
      .post('/api/v1/hris/departments')
      .set('x-tenant-id', 'tenant-hr-1')
      .set('x-actor-id', 'user-sales')
      .set('x-actor-roles', 'SALES_MANAGER')
      .set('x-actor-permissions', 'hris:write')
      .send({ name: 'Unauthorized Dept' });

    expect(forbiddenRoleRes.status).toBe(403);
  });

  it('should allow protected requests without tenant context header', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/hris/departments')
      .set('x-actor-id', 'user-hr-mgr')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'hris:read');

    expect(res.status).toBe(200);
  });
});
