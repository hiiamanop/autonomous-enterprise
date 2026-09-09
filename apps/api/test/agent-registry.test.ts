import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { AgentRegistryController } from '../src/modules/agent-registry/agent-registry.controller';
import { AgentRegistryService } from '../src/modules/agent-registry/agent-registry.service';
import { AGENT_REGISTRY_REPOSITORY } from '../src/modules/agent-registry/domain/agent-registry.repository.interface';
import { InMemoryAgentRegistryRepository } from '../src/modules/agent-registry/infrastructure/in-memory-agent-registry.repository';
import { TenantContextMiddleware } from '../src/common/tenant/tenant-context.middleware';
import { RbacGuard } from '../src/common/auth/rbac.guard';

describe('Agent Registry Module Domain & REST APIs', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AgentRegistryController],
      providers: [
        AgentRegistryService,
        {
          provide: AGENT_REGISTRY_REPOSITORY,
          useClass: InMemoryAgentRegistryRepository
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

  it('should register a new agent with default trust profile of 0.5', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/agent-registry')
      .set('x-tenant-id', 'tenant-reg-1')
      .set('x-actor-id', 'user-admin')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'agent-registry:write,agent-registry:read')
      .send({
        agentName: 'inventory-agent',
        version: '1.0.0',
        model: 'gpt-4o',
        capabilities: ['check_stock', 'reserve_stock'],
        costPerCall: 0.02
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agentName).toBe('inventory-agent');
    expect(res.body.data.version).toBe('1.0.0');
    expect(res.body.data.trustProfile).toBeDefined();
    expect(res.body.data.trustProfile.accuracy).toBe(0.5);
    expect(res.body.data.trustProfile.consistency).toBe(0.5);
    expect(res.body.data.trustProfile.calibration).toBe(0.5);
    expect(res.body.data.trustProfile.historicalSuccessRate).toBe(0.5);
    expect(res.body.data.trustProfile.failureRate).toBe(0.0);
    expect(res.body.data.trustProfile.policyViolations).toBe(0);
    expect(res.body.data.trustProfile.overallTrust).toBe(0.5);
    expect(res.body.data.trustProfile.sampleCount).toBe(0);
  });

  it('should update existing agent instead of creating duplicate when registered with same agentName', async () => {
    const tenantId = 'tenant-reg-2';
    const headers = {
      'x-tenant-id': tenantId,
      'x-actor-id': 'user-admin',
      'x-actor-roles': 'TENANT_ADMIN',
      'x-actor-permissions': 'agent-registry:write,agent-registry:read'
    };

    const firstRes = await request(app.getHttpServer())
      .post('/api/v1/agent-registry')
      .set(headers)
      .send({
        agentName: 'sales-agent',
        version: '1.0.0',
        model: 'gpt-4o',
        capabilities: ['create_quote']
      });
    expect(firstRes.status).toBe(201);
    const originalId = firstRes.body.data.id;

    const secondRes = await request(app.getHttpServer())
      .post('/api/v1/agent-registry')
      .set(headers)
      .send({
        agentName: 'sales-agent',
        version: '1.1.0',
        model: 'gpt-4o-mini',
        capabilities: ['create_quote', 'apply_discount'],
        costPerCall: 0.015
      });
    expect(secondRes.status).toBe(201);
    expect(secondRes.body.data.id).toBe(originalId);
    expect(secondRes.body.data.version).toBe('1.1.0');
    expect(secondRes.body.data.model).toBe('gpt-4o-mini');
    expect(secondRes.body.data.capabilities).toEqual(['create_quote', 'apply_discount']);

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/agent-registry')
      .set(headers);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].version).toBe('1.1.0');
  });

  it('should gradually increase overallTrust when recordTrustOutcome is called with success=true', async () => {
    const tenantId = 'tenant-reg-3';
    const headers = {
      'x-tenant-id': tenantId,
      'x-actor-id': 'orchestrator-1',
      'x-actor-roles': 'AI_ORCHESTRATOR',
      'x-actor-permissions': 'agent-registry:write,agent-registry:read'
    };

    await request(app.getHttpServer())
      .post('/api/v1/agent-registry')
      .set(headers)
      .send({
        agentName: 'finance-agent',
        version: '1.0.0',
        model: 'claude-3-5-sonnet',
        capabilities: ['post_journal']
      });

    let previousTrust = 0.5;
    for (let i = 0; i < 4; i++) {
      const outcomeRes = await request(app.getHttpServer())
        .post('/api/v1/agent-registry/finance-agent/trust-outcome')
        .set(headers)
        .send({
          success: true,
          confidence: 0.95
        });

      expect(outcomeRes.status).toBe(200);
      const currentTrust = outcomeRes.body.data.trustProfile.overallTrust;
      expect(currentTrust).toBeGreaterThan(previousTrust);
      expect(outcomeRes.body.data.trustProfile.sampleCount).toBe(i + 1);
      previousTrust = currentTrust;
    }
  });

  it('should decrease overallTrust when policyViolation=true is recorded', async () => {
    const tenantId = 'tenant-reg-4';
    const headers = {
      'x-tenant-id': tenantId,
      'x-actor-id': 'orchestrator-1',
      'x-actor-roles': 'AI_ORCHESTRATOR',
      'x-actor-permissions': 'agent-registry:write,agent-registry:read'
    };

    await request(app.getHttpServer())
      .post('/api/v1/agent-registry')
      .set(headers)
      .send({
        agentName: 'hr-agent',
        version: '1.0.0',
        model: 'gpt-4o',
        capabilities: ['process_leave']
      });

    const goodOutcome = await request(app.getHttpServer())
      .post('/api/v1/agent-registry/hr-agent/trust-outcome')
      .set(headers)
      .send({
        success: true,
        confidence: 0.9
      });
    const trustBeforeViolation = goodOutcome.body.data.trustProfile.overallTrust;

    const violationOutcome = await request(app.getHttpServer())
      .post('/api/v1/agent-registry/hr-agent/trust-outcome')
      .set(headers)
      .send({
        success: false,
        confidence: 0.3,
        policyViolation: true
      });

    expect(violationOutcome.status).toBe(200);
    expect(violationOutcome.body.data.trustProfile.policyViolations).toBe(1);
    expect(violationOutcome.body.data.trustProfile.overallTrust).toBeLessThan(trustBeforeViolation);
  });

  it('should auto-register an unregistered agent when recordTrustOutcome is called', async () => {
    const tenantId = 'tenant-reg-5';
    const headers = {
      'x-tenant-id': tenantId,
      'x-actor-id': 'orchestrator-1',
      'x-actor-roles': 'AI_ORCHESTRATOR',
      'x-actor-permissions': 'agent-registry:write,agent-registry:read'
    };

    const outcomeRes = await request(app.getHttpServer())
      .post('/api/v1/agent-registry/unknown-worker-agent/trust-outcome')
      .set(headers)
      .send({
        success: true,
        confidence: 0.85
      });

    expect(outcomeRes.status).toBe(200);
    expect(outcomeRes.body.data.agentName).toBe('unknown-worker-agent');
    expect(outcomeRes.body.data.version).toBe('0.0.0');
    expect(outcomeRes.body.data.model).toBe('unknown');
    expect(outcomeRes.body.data.capabilities).toEqual([]);
    expect(outcomeRes.body.data.trustProfile.sampleCount).toBe(1);

    const getRes = await request(app.getHttpServer())
      .get('/api/v1/agent-registry/unknown-worker-agent')
      .set(headers);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.agentName).toBe('unknown-worker-agent');
  });

  it('should find registered agent by name across enterprise', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/agent-registry')
      .set('x-actor-id', 'admin-alpha')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'agent-registry:write,agent-registry:read')
      .send({
        agentName: 'alpha-agent',
        version: '1.0.0',
        model: 'model-a',
        capabilities: ['cap-a']
      });

    const getRes = await request(app.getHttpServer())
      .get('/api/v1/agent-registry/alpha-agent')
      .set('x-actor-id', 'admin-beta')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'agent-registry:read');

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.agentName).toBe('alpha-agent');
  });

  it('should return 403 Forbidden without appropriate roles or permissions', async () => {
    const resNoRole = await request(app.getHttpServer())
      .post('/api/v1/agent-registry')
      .set('x-tenant-id', 'tenant-sec')
      .set('x-actor-id', 'regular-employee')
      .set('x-actor-roles', 'EMPLOYEE')
      .set('x-actor-permissions', 'agent-registry:write')
      .send({
        agentName: 'unauthorized-agent',
        version: '1.0.0',
        model: 'model-x',
        capabilities: []
      });

    expect(resNoRole.status).toBe(403);

    const resNoPerm = await request(app.getHttpServer())
      .post('/api/v1/agent-registry')
      .set('x-tenant-id', 'tenant-sec')
      .set('x-actor-id', 'admin-no-perm')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'finance:read')
      .send({
        agentName: 'unauthorized-agent',
        version: '1.0.0',
        model: 'model-x',
        capabilities: []
      });

    expect(resNoPerm.status).toBe(403);
  });

  it('should update agent availability', async () => {
    const headers = {
      'x-tenant-id': 'tenant-avail-1',
      'x-actor-id': 'admin-1',
      'x-actor-roles': 'TENANT_ADMIN',
      'x-actor-permissions': 'agent-registry:write,agent-registry:read'
    };

    await request(app.getHttpServer())
      .post('/api/v1/agent-registry')
      .set(headers)
      .send({
        agentName: 'shipping-agent',
        version: '1.0.0',
        model: 'gpt-4o',
        capabilities: ['dispatch']
      });

    const updateRes = await request(app.getHttpServer())
      .post('/api/v1/agent-registry/shipping-agent/availability')
      .set(headers)
      .send({ availability: 'DEGRADED' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.availability).toBe('DEGRADED');

    const getRes = await request(app.getHttpServer())
      .get('/api/v1/agent-registry/shipping-agent')
      .set(headers);
    expect(getRes.body.data.availability).toBe('DEGRADED');
  });
});
