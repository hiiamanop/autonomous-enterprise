import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SignJWT } from 'jose';
import { AppModule } from '../src/app.module';
import { KeycloakJwtService } from '../src/common/auth/keycloak-jwt.service';

const TEST_SECRET = 'test-secret-key-for-keycloak-jwt-validation';

describe('Keycloak JWT Auth Validation', () => {
  let app: INestApplication;
  let jwtService: KeycloakJwtService;

  beforeEach(async () => {
    process.env.JWT_SECRET = TEST_SECRET;
    process.env.KEYCLOAK_ISSUER = 'http://localhost:8080/realms/autonomous-enterprise';
    process.env.KEYCLOAK_AUDIENCE = 'autonomous-enterprise-api';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    jwtService = new KeycloakJwtService();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should correctly map Keycloak JWT claims to tenant context and actor identity', async () => {
    const payload = {
      sub: 'usr-keycloak-123',
      tenant_id: 'tenant-keycloak-1',
      realm_access: {
        roles: ['SALES_MANAGER', 'EMPLOYEE'],
      },
      permissions: ['sales:read', 'sales:write'],
      scope: 'openid profile email',
    };

    const mapped = jwtService.mapClaimsToContext(payload as any);
    expect(mapped.actor.id).toBe('usr-keycloak-123');
    expect(mapped.actor.roles).toContain('SALES_MANAGER');
    expect(mapped.actor.permissions).toContain('sales:read');
    expect(mapped.actor.type).toBe('user');
  });

  it('should map AI agent claims correctly', async () => {
    const payload = {
      sub: 'ai-sales-bot-01',
      tenant_id: 'tenant-keycloak-1',
      realm_access: {
        roles: ['AI_SALES_AGENT'],
      },
      scope: 'agent:execute',
    };

    const mapped = jwtService.mapClaimsToContext(payload as any);
    expect(mapped.actor.type).toBe('agent');
    expect(mapped.actor.permissions).toContain('agent:execute');
  });

  it('should authenticate protected request with valid signed JWT token', async () => {
    const secretKey = new TextEncoder().encode(TEST_SECRET);
    const token = await new SignJWT({
      sub: 'mgr-jwt-1',
      tenant_id: 'tenant-100',
      realm_access: { roles: ['SALES_MANAGER'] },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('http://localhost:8080/realms/autonomous-enterprise')
      .setAudience('autonomous-enterprise-api')
      .setExpirationTime('1h')
      .sign(secretKey);

    const response = await request(app.getHttpServer())
      .get('/api/v1/protected/user-only')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should reject invalid or expired JWT token', async () => {
    const secretKey = new TextEncoder().encode(TEST_SECRET);
    const token = await new SignJWT({
      sub: 'mgr-jwt-1',
      tenant_id: 'tenant-100',
      realm_access: { roles: ['SALES_MANAGER'] },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('-1s')
      .sign(secretKey);

    const response = await request(app.getHttpServer())
      .get('/api/v1/protected/user-only')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it('should reject non-public request when missing token in non-test runtime', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const response = await request(app.getHttpServer())
        .get('/api/v1/protected/user-only')
        .set('x-tenant-id', 'tenant-100')
        .set('x-actor-id', 'mgr-1')
        .set('x-actor-roles', 'SALES_MANAGER');

      expect(response.status).toBe(401);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('should allow public health endpoint without authentication token even in production mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const response = await request(app.getHttpServer()).get('/api/v1/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
