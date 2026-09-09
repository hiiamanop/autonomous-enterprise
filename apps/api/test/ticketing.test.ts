import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { TicketingController } from '../src/modules/ticketing/ticketing.controller';
import { TicketingService } from '../src/modules/ticketing/ticketing.service';
import { TICKETING_REPOSITORY } from '../src/modules/ticketing/domain/ticketing.repository.interface';
import { InMemoryTicketingRepository } from '../src/modules/ticketing/infrastructure/in-memory-ticketing.repository';
import { AuditService } from '../src/common/audit/audit.service';
import { TenantContextMiddleware } from '../src/common/tenant/tenant-context.middleware';
import { RbacGuard } from '../src/common/auth/rbac.guard';

describe('Ticketing Module Domain & REST APIs', () => {
  let app: INestApplication;
  let ticketingService: TicketingService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TicketingController],
      providers: [
        TicketingService,
        AuditService,
        {
          provide: TICKETING_REPOSITORY,
          useClass: InMemoryTicketingRepository
        },
        {
          provide: APP_GUARD,
          useClass: RbacGuard
        }
      ]
    }).compile();

    ticketingService = moduleFixture.get(TicketingService);
    app = moduleFixture.createNestApplication();
    app.use(new TenantContextMiddleware().use);
    await app.init();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
  });

  it('should create and retrieve a ticket', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('x-tenant-id', 'tenant-tkt-1')
      .set('x-actor-id', 'user-admin-1')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'ticketing:write,ticketing:read')
      .send({
        title: 'Payment Gateway Timeout',
        description: 'Webhook failing intermittently',
        source: 'AI_ORCHESTRATOR',
        priority: 'HIGH'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.title).toBe('Payment Gateway Timeout');
    expect(res.body.data.status).toBe('OPEN');
    expect(res.body.data.priority).toBe('HIGH');

    const ticketId = res.body.data.id;
    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}`)
      .set('x-tenant-id', 'tenant-tkt-1')
      .set('x-actor-id', 'user-admin-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:read');

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(ticketId);
    expect(getRes.body.data.source).toBe('AI_ORCHESTRATOR');
  });

  it('should list tickets and filter by status', async () => {
    // Create ticket 1 (OPEN)
    await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('x-tenant-id', 'tenant-tkt-filter')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ title: 'Issue 1', source: 'Manual' });

    // Create ticket 2 (will transition to TRIAGED)
    const t2Res = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('x-tenant-id', 'tenant-tkt-filter')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ title: 'Issue 2', source: 'Manual' });

    await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${t2Res.body.data.id}/status`)
      .set('x-tenant-id', 'tenant-tkt-filter')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ status: 'TRIAGED' });

    const allRes = await request(app.getHttpServer())
      .get('/api/v1/tickets')
      .set('x-tenant-id', 'tenant-tkt-filter')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:read');

    expect(allRes.status).toBe(200);
    expect(allRes.body.data.length).toBe(2);

    const filteredRes = await request(app.getHttpServer())
      .get('/api/v1/tickets?status=TRIAGED')
      .set('x-tenant-id', 'tenant-tkt-filter')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:read');

    expect(filteredRes.status).toBe(200);
    expect(filteredRes.body.data.length).toBe(1);
    expect(filteredRes.body.data[0].id).toBe(t2Res.body.data.id);
  });

  it('should enforce valid ticket status transitions and reject invalid transitions', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('x-tenant-id', 'tenant-tkt-trans')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ title: 'Transition Test', source: 'System' });

    const ticketId = createRes.body.data.id;

    // Invalid transition: OPEN directly to RESOLVED without intermediate steps
    const invalidRes = await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}/status`)
      .set('x-tenant-id', 'tenant-tkt-trans')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ status: 'RESOLVED' });

    expect(invalidRes.status).toBe(400);

    // Valid: OPEN -> ESCALATED -> HUMAN_REVIEW -> RESOLVED -> CLOSED
    const escRes = await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}/status`)
      .set('x-tenant-id', 'tenant-tkt-trans')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ status: 'ESCALATED' });
    expect(escRes.status).toBe(200);
    expect(escRes.body.data.status).toBe('ESCALATED');

    const hrRes = await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}/status`)
      .set('x-tenant-id', 'tenant-tkt-trans')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ status: 'HUMAN_REVIEW' });
    expect(hrRes.status).toBe(200);
    expect(hrRes.body.data.status).toBe('HUMAN_REVIEW');

    const resRes = await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}/status`)
      .set('x-tenant-id', 'tenant-tkt-trans')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ status: 'RESOLVED' });
    expect(resRes.status).toBe(200);
    expect(resRes.body.data.status).toBe('RESOLVED');
  });

  it('should add comments and list comments in chronological order', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('x-tenant-id', 'tenant-tkt-comm')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ title: 'Comment Test', source: 'Helpdesk' });

    const ticketId = createRes.body.data.id;

    // Add first comment
    const c1Res = await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .set('x-tenant-id', 'tenant-tkt-comm')
      .set('x-actor-id', 'user-employee-1')
      .set('x-actor-roles', 'EMPLOYEE')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ authorId: 'user-employee-1', body: 'Investigating initial logs' });

    expect(c1Res.status).toBe(201);
    expect(c1Res.body.success).toBe(true);
    expect(c1Res.body.data.id).toBeDefined();
    expect(c1Res.body.data.ticketId).toBe(ticketId);
    expect(c1Res.body.data.body).toBe('Investigating initial logs');

    // Add second comment
    const c2Res = await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .set('x-tenant-id', 'tenant-tkt-comm')
      .set('x-actor-id', 'user-admin-1')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ authorId: 'user-admin-1', body: 'Root cause identified' });

    expect(c2Res.status).toBe(201);

    // List comments
    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}/comments`)
      .set('x-tenant-id', 'tenant-tkt-comm')
      .set('x-actor-id', 'user-employee-1')
      .set('x-actor-roles', 'EMPLOYEE')
      .set('x-actor-permissions', 'ticketing:read');

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(2);
    expect(listRes.body.data[0].body).toBe('Investigating initial logs');
    expect(listRes.body.data[1].body).toBe('Root cause identified');
  });

  it('should assign ticket, update assignedTo, and transition status to ASSIGNED', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('x-tenant-id', 'tenant-tkt-asgn')
      .set('x-actor-id', 'user-admin')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ title: 'Assignment test', source: 'Manual' });

    const ticketId = createRes.body.data.id;
    expect(createRes.body.data.status).toBe('OPEN');

    // Assign ticket
    const assignRes = await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/assign`)
      .set('x-tenant-id', 'tenant-tkt-asgn')
      .set('x-actor-id', 'user-admin')
      .set('x-actor-roles', 'HR_MANAGER')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ assigneeId: 'staff-eng-42', assignedBy: 'user-admin' });

    expect(assignRes.status).toBe(200);
    expect(assignRes.body.success).toBe(true);
    expect(assignRes.body.data.assigneeId).toBe('staff-eng-42');
    expect(assignRes.body.data.assignedBy).toBe('user-admin');

    // Verify ticket assignedTo & status updated
    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}`)
      .set('x-tenant-id', 'tenant-tkt-asgn')
      .set('x-actor-id', 'user-admin')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:read');

    expect(getRes.body.data.assignedTo).toBe('staff-eng-42');
    expect(getRes.body.data.status).toBe('ASSIGNED');
  });

  it('should list assignment history in reverse chronological order', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('x-tenant-id', 'tenant-tkt-asgn-hist')
      .set('x-actor-id', 'user-admin')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ title: 'Re-assignment test', source: 'Manual' });

    const ticketId = createRes.body.data.id;

    // First assignment
    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/assign`)
      .set('x-tenant-id', 'tenant-tkt-asgn-hist')
      .set('x-actor-id', 'user-admin')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ assigneeId: 'engineer-1' });

    // Second assignment
    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/assign`)
      .set('x-tenant-id', 'tenant-tkt-asgn-hist')
      .set('x-actor-id', 'user-admin')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ assigneeId: 'engineer-2', assignedBy: 'user-admin' });

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}/assignments`)
      .set('x-tenant-id', 'tenant-tkt-asgn-hist')
      .set('x-actor-id', 'user-admin')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:read');

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(2);
    expect(listRes.body.data[0].assigneeId).toBe('engineer-2');
    expect(listRes.body.data[1].assigneeId).toBe('engineer-1');
  });

  it('should attach SLA and compute responseDueAt and resolutionDueAt correctly', async () => {
    const baseTime = new Date('2026-09-02T10:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('x-tenant-id', 'tenant-tkt-sla')
      .set('x-actor-id', 'user-admin')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ title: 'SLA test', source: 'Manual', priority: 'CRITICAL' });

    const ticketId = createRes.body.data.id;

    // Attach SLA: 15 min response, 60 min resolution
    const slaRes = await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/sla`)
      .set('x-tenant-id', 'tenant-tkt-sla')
      .set('x-actor-id', 'user-admin')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ responseDueInMinutes: 15, resolutionDueInMinutes: 60 });

    expect(slaRes.status).toBe(201);
    expect(slaRes.body.success).toBe(true);
    expect(slaRes.body.data.ticketId).toBe(ticketId);
    expect(slaRes.body.data.responseDueAt).toBe('2026-09-02T10:15:00.000Z');
    expect(slaRes.body.data.resolutionDueAt).toBe('2026-09-02T11:00:00.000Z');
    expect(slaRes.body.data.responseBreached).toBe(false);
    expect(slaRes.body.data.resolutionBreached).toBe(false);

    // Duplicate SLA attachment should be rejected
    const dupRes = await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/sla`)
      .set('x-tenant-id', 'tenant-tkt-sla')
      .set('x-actor-id', 'user-admin')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ responseDueInMinutes: 10, resolutionDueInMinutes: 30 });

    expect(dupRes.status).toBe(400);
  });

  it('should record SLA response on time (responseBreached = false)', async () => {
    const baseTime = new Date('2026-09-02T10:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('x-tenant-id', 'tenant-sla-ontime')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ title: 'On-time response test', source: 'Manual' });

    const ticketId = createRes.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/sla`)
      .set('x-tenant-id', 'tenant-sla-ontime')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ responseDueInMinutes: 30, resolutionDueInMinutes: 120 });

    // Advance time by 10 minutes (within 30 mins)
    vi.advanceTimersByTime(10 * 60 * 1000);

    const respRes = await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/sla/respond`)
      .set('x-tenant-id', 'tenant-sla-ontime')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write');

    expect(respRes.status).toBe(200);
    expect(respRes.body.data.respondedAt).toBe('2026-09-02T10:10:00.000Z');
    expect(respRes.body.data.responseBreached).toBe(false);
  });

  it('should record SLA response after due time and mark responseBreached = true', async () => {
    const baseTime = new Date('2026-09-02T10:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('x-tenant-id', 'tenant-sla-resp-late')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ title: 'Late response test', source: 'Manual' });

    const ticketId = createRes.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/sla`)
      .set('x-tenant-id', 'tenant-sla-resp-late')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ responseDueInMinutes: 15, resolutionDueInMinutes: 60 });

    // Advance time by 20 minutes (overdue by 5 mins)
    vi.advanceTimersByTime(20 * 60 * 1000);

    const respRes = await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/sla/respond`)
      .set('x-tenant-id', 'tenant-sla-resp-late')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write');

    expect(respRes.status).toBe(200);
    expect(respRes.body.data.respondedAt).toBe('2026-09-02T10:20:00.000Z');
    expect(respRes.body.data.responseBreached).toBe(true);
  });

  it('should record SLA resolution on time (resolutionBreached = false)', async () => {
    const baseTime = new Date('2026-09-02T10:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('x-tenant-id', 'tenant-sla-res-ontime')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ title: 'On-time resolution test', source: 'Manual' });

    const ticketId = createRes.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/sla`)
      .set('x-tenant-id', 'tenant-sla-res-ontime')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ responseDueInMinutes: 15, resolutionDueInMinutes: 60 });

    // Advance time by 45 minutes (within 60 mins)
    vi.advanceTimersByTime(45 * 60 * 1000);

    const resRes = await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/sla/resolve`)
      .set('x-tenant-id', 'tenant-sla-res-ontime')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write');

    expect(resRes.status).toBe(200);
    expect(resRes.body.data.resolvedAt).toBe('2026-09-02T10:45:00.000Z');
    expect(resRes.body.data.resolutionBreached).toBe(false);
  });

  it('should record SLA resolution after due time and mark resolutionBreached = true', async () => {
    const baseTime = new Date('2026-09-02T10:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('x-tenant-id', 'tenant-sla-res-late')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ title: 'Late resolution test', source: 'Manual' });

    const ticketId = createRes.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/sla`)
      .set('x-tenant-id', 'tenant-sla-res-late')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ responseDueInMinutes: 15, resolutionDueInMinutes: 30 });

    // Advance time by 45 minutes (resolution was due at +30 mins)
    vi.advanceTimersByTime(45 * 60 * 1000);

    const resRes = await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/sla/resolve`)
      .set('x-tenant-id', 'tenant-sla-res-late')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write');

    expect(resRes.status).toBe(200);
    expect(resRes.body.data.resolvedAt).toBe('2026-09-02T10:45:00.000Z');
    expect(resRes.body.data.resolutionBreached).toBe(true);
  });

  it('should passively detect SLA breaches via checkSlaBreaches', async () => {
    const baseTime = new Date('2026-09-02T10:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('x-tenant-id', 'tenant-sla-breach-check')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ title: 'Breach passive detection test', source: 'Manual' });

    const ticketId = createRes.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/sla`)
      .set('x-tenant-id', 'tenant-sla-breach-check')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ responseDueInMinutes: 10, resolutionDueInMinutes: 30 });

    // Advance time past resolutionDueAt (by 40 minutes)
    vi.advanceTimersByTime(40 * 60 * 1000);

    const checkRes = await request(app.getHttpServer())
      .post('/api/v1/tickets/sla/check-breaches')
      .set('x-tenant-id', 'tenant-sla-breach-check')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write');

    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data.length).toBe(1);
    expect(checkRes.body.data[0].responseBreached).toBe(true);
    expect(checkRes.body.data[0].resolutionBreached).toBe(true);
  });

  it('should get ticket with complete details (comments, assignments, sla)', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('x-tenant-id', 'tenant-details')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ title: 'Full details test', description: 'Testing aggregation', source: 'System' });

    const ticketId = createRes.body.data.id;

    // Add comment
    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .set('x-tenant-id', 'tenant-details')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ authorId: 'user-1', body: 'Added initial comment' });

    // Assign ticket
    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/assign`)
      .set('x-tenant-id', 'tenant-details')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ assigneeId: 'dev-99' });

    // Attach SLA
    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/sla`)
      .set('x-tenant-id', 'tenant-details')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ responseDueInMinutes: 20, resolutionDueInMinutes: 100 });

    const detailsRes = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}/details`)
      .set('x-tenant-id', 'tenant-details')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:read');

    expect(detailsRes.status).toBe(200);
    expect(detailsRes.body.data.id).toBe(ticketId);
    expect(detailsRes.body.data.comments.length).toBe(1);
    expect(detailsRes.body.data.comments[0].body).toBe('Added initial comment');
    expect(detailsRes.body.data.assignments.length).toBe(1);
    expect(detailsRes.body.data.assignments[0].assigneeId).toBe('dev-99');
    expect(detailsRes.body.data.sla).toBeDefined();
    expect(detailsRes.body.data.sla.ticketId).toBe(ticketId);
  });

  it('should retrieve tickets, comments, assignments, and SLA across enterprise', async () => {
    // Creates ticket and details
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('x-actor-id', 'user-A')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ title: 'Enterprise Ticket', source: 'Enterprise' });

    const ticketId = createRes.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .set('x-actor-id', 'user-A')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ authorId: 'user-A', body: 'Enterprise notes' });

    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/assign`)
      .set('x-actor-id', 'user-A')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:write')
      .send({ assigneeId: 'staff-A' });

    // Another user accesses Ticket
    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}`)
      .set('x-actor-id', 'user-B')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:read');

    expect(getRes.status).toBe(200);

    const detailsRes = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}/details`)
      .set('x-actor-id', 'user-B')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:read');

    expect(detailsRes.status).toBe(200);

    const commRes = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}/comments`)
      .set('x-actor-id', 'user-B')
      .set('x-actor-roles', 'OPERATOR')
      .set('x-actor-permissions', 'ticketing:read');

    expect(commRes.status).toBe(200);
  });

  it('should enforce RBAC authorization for write and read endpoints', async () => {
    // Missing permission
    const unauthRes = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('x-actor-id', 'user-guest')
      .set('x-actor-roles', 'EMPLOYEE')
      .set('x-actor-permissions', 'other:permission')
      .send({ title: 'Unauthorized', source: 'Manual' });

    expect(unauthRes.status).toBe(403);
  });

  it('should support createSystemTicket programmatic interface with exact signature', async () => {
    const sysTicket = await ticketingService.createSystemTicket(
      'Circuit Breaker Triggered',
      'Max iterations reached',
      'CircuitBreaker',
      'CRITICAL',
      'wf-123'
    );

    expect(sysTicket.id).toBeDefined();
    expect(sysTicket.title).toBe('Circuit Breaker Triggered');
    expect(sysTicket.description).toBe('Max iterations reached');
    expect(sysTicket.source).toBe('CircuitBreaker');
    expect(sysTicket.priority).toBe('CRITICAL');
    expect(sysTicket.workflowId).toBe('wf-123');
    expect(sysTicket.status).toBe('OPEN');
  });
});
