import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Authorization & Identity Model', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should allow user with required role to access user endpoint', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/protected/user-only')
      .set('x-tenant-id', 'tenant-100')
      .set('x-actor-id', 'mgr-1')
      .set('x-actor-roles', 'SALES_MANAGER');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should forbid user without required role from accessing user endpoint', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/protected/user-only')
      .set('x-tenant-id', 'tenant-100')
      .set('x-actor-id', 'emp-1')
      .set('x-actor-roles', 'EMPLOYEE');

    expect(response.status).toBe(403);
  });

  it('should authorize AI Agent with agent identity role and permission', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/protected/agent-action')
      .set('x-tenant-id', 'tenant-100')
      .set('x-actor-id', 'ai-sales-bot-01')
      .set('x-actor-type', 'agent')
      .set('x-actor-roles', 'AI_SALES_AGENT')
      .set('x-actor-permissions', 'agent:execute');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toContain('ai-sales-bot-01');
  });

  it('should forbid AI Agent without agent:execute permission', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/protected/agent-action')
      .set('x-tenant-id', 'tenant-100')
      .set('x-actor-id', 'ai-sales-bot-01')
      .set('x-actor-type', 'agent')
      .set('x-actor-roles', 'AI_SALES_AGENT')
      .set('x-actor-permissions', 'read:only');

    expect(response.status).toBe(403);
  });
});
