import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Enterprise Request Context Foundation', () => {
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

  it('should allow public health endpoint without request context header', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('should allow protected request without a tenant header', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tenant/profile')
      .set('x-actor-id', 'user-1')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'tenant:read');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.actor.id).toBe('user-1');
  });

  it('should isolate actor identity between different requests', async () => {
    const resA = await request(app.getHttpServer())
      .get('/api/v1/tenant/profile')
      .set('x-actor-id', 'user-a')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'tenant:read');

    const resB = await request(app.getHttpServer())
      .get('/api/v1/tenant/profile')
      .set('x-actor-id', 'user-b')
      .set('x-actor-roles', 'TENANT_ADMIN')
      .set('x-actor-permissions', 'tenant:read');

    expect(resA.body.data.actor.id).toBe('user-a');
    expect(resB.body.data.actor.id).toBe('user-b');
  });
});
