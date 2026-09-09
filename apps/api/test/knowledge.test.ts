import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { KnowledgeController } from '../src/modules/knowledge/knowledge.controller';
import { KnowledgeService } from '../src/modules/knowledge/knowledge.service';
import { KNOWLEDGE_REPOSITORY } from '../src/modules/knowledge/domain/knowledge.repository.interface';
import { InMemoryKnowledgeRepository } from '../src/modules/knowledge/infrastructure/in-memory-knowledge.repository';
import { TenantContextMiddleware } from '../src/common/tenant/tenant-context.middleware';
import { RbacGuard } from '../src/common/auth/rbac.guard';
import { TenantContextStorage } from '@autonomous-enterprise/shared';

describe('Knowledge/RAG Module Domain & REST APIs', () => {
  let app: INestApplication;
  let service: KnowledgeService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [KnowledgeController],
      providers: [
        KnowledgeService,
        {
          provide: KNOWLEDGE_REPOSITORY,
          useClass: InMemoryKnowledgeRepository
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
    service = moduleFixture.get(KnowledgeService);
  });

  afterEach(async () => {
    await app.close();
  });

  const headers = (tenantId: string) => ({
    'x-tenant-id': tenantId,
    'x-actor-id': 'user-admin',
    'x-actor-roles': 'TENANT_ADMIN',
    'x-actor-permissions': 'knowledge:read,knowledge:write'
  });

  it('should create a knowledge document for the enterprise', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/knowledge/documents')
      .set(headers('tenant-kb-1'))
      .send({
        sourceType: 'SOP',
        title: 'Order Fulfillment SOP',
        content: 'Steps to fulfill an order: validate, reserve stock, ship.',
        tags: ['sales', 'fulfillment']
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.sourceType).toBe('SOP');
  });

  it('should list all enterprise documents', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/knowledge/documents')
      .set(headers('tenant-kb-a'))
      .send({ sourceType: 'HR_POLICY', title: 'Leave Policy A', content: 'Tenant A leave policy content.' });

    await request(app.getHttpServer())
      .post('/api/v1/knowledge/documents')
      .set(headers('tenant-kb-b'))
      .send({ sourceType: 'HR_POLICY', title: 'Leave Policy B', content: 'Tenant B leave policy content.' });

    const listA = await request(app.getHttpServer())
      .get('/api/v1/knowledge/documents')
      .set(headers('tenant-kb-a'));

    expect(listA.body.data).toHaveLength(2);
    expect(listA.body.data.map((d: any) => d.title)).toEqual(expect.arrayContaining(['Leave Policy A', 'Leave Policy B']));
  });

  it('should allow retrieving any enterprise document', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/knowledge/documents')
      .set(headers('tenant-kb-owner'))
      .send({ sourceType: 'FINANCIAL_POLICY', title: 'Budget Policy', content: 'Budget approval thresholds.' });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/knowledge/documents/${created.body.data.id}`)
      .set(headers('tenant-kb-intruder'));

    expect(res.status).toBe(200);
  });

  it('should update a document and bump updatedAt', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/knowledge/documents')
      .set(headers('tenant-kb-update'))
      .send({ sourceType: 'TECHNICAL_DOCUMENTATION', title: 'API Guide v1', content: 'Initial content.' });

    const updated = await request(app.getHttpServer())
      .put(`/api/v1/knowledge/documents/${created.body.data.id}`)
      .set(headers('tenant-kb-update'))
      .send({ title: 'API Guide v2', content: 'Updated content.' });

    expect(updated.status).toBe(200);
    expect(updated.body.data.title).toBe('API Guide v2');
    expect(updated.body.data.content).toBe('Updated content.');
  });

  it('should delete a document', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/knowledge/documents')
      .set(headers('tenant-kb-delete'))
      .send({ sourceType: 'PRODUCT_CATALOG', title: 'Catalog Entry', content: 'Widget A specs.' });

    const del = await request(app.getHttpServer())
      .delete(`/api/v1/knowledge/documents/${created.body.data.id}`)
      .set(headers('tenant-kb-delete'));
    expect(del.status).toBe(200);

    const getAfterDelete = await request(app.getHttpServer())
      .get(`/api/v1/knowledge/documents/${created.body.data.id}`)
      .set(headers('tenant-kb-delete'));
    expect(getAfterDelete.status).toBe(404);
  });

  it('should search documents by keyword and rank by relevance score', async () => {
    const tenantId = 'tenant-kb-search';
    await request(app.getHttpServer())
      .post('/api/v1/knowledge/documents')
      .set(headers(tenantId))
      .send({
        sourceType: 'PROCUREMENT_POLICY',
        title: 'Supplier Verification Policy',
        content: 'All suppliers must be verified before purchase order approval.'
      });
    await request(app.getHttpServer())
      .post('/api/v1/knowledge/documents')
      .set(headers(tenantId))
      .send({
        sourceType: 'HR_POLICY',
        title: 'Remote Work Policy',
        content: 'Employees may work remotely with manager approval.'
      });

    const res = await request(app.getHttpServer())
      .post('/api/v1/knowledge/search')
      .set(headers(tenantId))
      .send({ query: 'supplier verification purchase' });

    expect(res.status).toBe(201);
    expect(res.body.data.documents.length).toBeGreaterThan(0);
    expect(res.body.data.documents[0].title).toBe('Supplier Verification Policy');
    expect(res.body.data.scores[0]).toBeGreaterThan(0);
  });

  it('should filter search results by sourceType', async () => {
    const tenantId = 'tenant-kb-filter';
    await request(app.getHttpServer())
      .post('/api/v1/knowledge/documents')
      .set(headers(tenantId))
      .send({ sourceType: 'SOP', title: 'Return Process', content: 'How to process a return.' });
    await request(app.getHttpServer())
      .post('/api/v1/knowledge/documents')
      .set(headers(tenantId))
      .send({ sourceType: 'HISTORICAL_CASE', title: 'Return Dispute Case', content: 'Prior return dispute case.' });

    const res = await request(app.getHttpServer())
      .get('/api/v1/knowledge/documents')
      .query({ sourceType: 'SOP' })
      .set(headers(tenantId));

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].sourceType).toBe('SOP');
  });

  it('should return empty search results when no terms match', async () => {
    const tenantId = 'tenant-kb-nomatch';
    await request(app.getHttpServer())
      .post('/api/v1/knowledge/documents')
      .set(headers(tenantId))
      .send({ sourceType: 'SOP', title: 'Onboarding SOP', content: 'Steps to onboard a new employee.' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/knowledge/search')
      .set(headers(tenantId))
      .send({ query: 'zzz nonexistent xyz' });

    expect(res.body.data.documents).toHaveLength(0);
  });

  it('should reject creation with missing required fields', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/knowledge/documents')
      .set(headers('tenant-kb-invalid'))
      .send({ sourceType: 'SOP' });

    expect(res.status).toBe(400);
  });

  it('should support retrieveEvidence for programmatic use as supporting evidence in AI workflows', async () => {
    await TenantContextStorage.run(
      {
        tenantId: 'tenant-kb-evidence',
        actor: { id: 'sys', type: 'agent', tenantId: 'tenant-kb-evidence', roles: [], permissions: [] }
      },
      async () => {
        await service.createDocument({
          sourceType: 'FINANCIAL_POLICY' as never,
          title: 'Overtime Cost Policy',
          content: 'Overtime above $200 requires finance justification and manager sign-off.',
          tags: ['overtime', 'finance']
        });

        const evidence = await service.retrieveEvidence('overtime cost justification');
        expect(evidence.length).toBeGreaterThan(0);
        expect(evidence[0].document.title).toBe('Overtime Cost Policy');
      }
    );
  });
});
