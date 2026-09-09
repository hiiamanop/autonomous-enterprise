import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, decodeJwt, JWTVerifyGetKey, JWTPayload } from 'jose';
import type { ActorIdentity } from '@autonomous-enterprise/contracts';

export interface KeycloakJwtConfig {
  issuer?: string;
  jwksUri?: string;
  audience?: string | string[];
  secret?: string;
}

export interface VerifiedJwtContext {
  actor: ActorIdentity;
}

@Injectable()
export class KeycloakJwtService {
  private jwks: JWTVerifyGetKey | null = null;
  private jwksUri: string | null = null;

  private getConfig(): KeycloakJwtConfig {
    const issuer = process.env.KEYCLOAK_ISSUER || process.env.JWT_ISSUER;
    const jwksUri =
      process.env.KEYCLOAK_JWKS_URI ||
      process.env.JWT_JWKS_URI ||
      (issuer ? `${issuer.replace(/\/$/, '')}/protocol/openid-connect/certs` : undefined);
    const audience = process.env.KEYCLOAK_AUDIENCE || process.env.JWT_AUDIENCE;
    const secret = process.env.KEYCLOAK_SECRET || process.env.JWT_SECRET;

    return { issuer, jwksUri, audience, secret };
  }

  private getJWKS(jwksUri: string): JWTVerifyGetKey {
    if (!this.jwks || this.jwksUri !== jwksUri) {
      this.jwks = createRemoteJWKSet(new URL(jwksUri));
      this.jwksUri = jwksUri;
    }
    return this.jwks;
  }

  async verifyToken(token: string, secretOverride?: string): Promise<VerifiedJwtContext> {
    const config = this.getConfig();
    const activeSecret = secretOverride || config.secret;

    let payload: JWTPayload;

    try {
      if (activeSecret) {
        const secretKey = new TextEncoder().encode(activeSecret);
        const res = await jwtVerify(token, secretKey, {
          issuer: config.issuer || undefined,
          audience: config.audience || undefined,
        });
        payload = res.payload;
      } else if (config.jwksUri) {
        const jwks = this.getJWKS(config.jwksUri);
        const res = await jwtVerify(token, jwks, {
          issuer: config.issuer || undefined,
          audience: config.audience || undefined,
        });
        payload = res.payload;
      } else if (process.env.NODE_ENV === 'test') {
        payload = decodeJwt(token);
      } else {
        throw new Error('Keycloak JWKS URI or JWT Secret is not configured');
      }
    } catch (err: any) {
      throw new UnauthorizedException(`Invalid or expired token: ${err.message}`);
    }

    return this.mapClaimsToContext(payload);
  }

  mapClaimsToContext(payload: JWTPayload & Record<string, any>): VerifiedJwtContext {
    const subject = (payload.sub || payload.preferred_username || payload.client_id || 'anonymous') as string;
    const tenantId = (payload.tenant_id || payload.tenantId || payload.tenant || payload.gss_tenant_id || '') as string;

    const rolesSet = new Set<string>();

    if (Array.isArray(payload.realm_access?.roles)) {
      payload.realm_access.roles.forEach((r: unknown) => {
        if (typeof r === 'string') rolesSet.add(r);
      });
    }

    if (payload.resource_access && typeof payload.resource_access === 'object') {
      for (const clientKey of Object.keys(payload.resource_access)) {
        const clientObj = (payload.resource_access as Record<string, any>)[clientKey];
        if (Array.isArray(clientObj?.roles)) {
          clientObj.roles.forEach((r: unknown) => {
            if (typeof r === 'string') rolesSet.add(r);
          });
        }
      }
    }

    if (Array.isArray(payload.roles)) {
      payload.roles.forEach((r: unknown) => {
        if (typeof r === 'string') rolesSet.add(r);
      });
    } else if (typeof payload.roles === 'string') {
      payload.roles.split(',').forEach((r: string) => rolesSet.add(r.trim()));
    }

    const permissionsSet = new Set<string>();

    if (Array.isArray(payload.permissions)) {
      payload.permissions.forEach((p: unknown) => {
        if (typeof p === 'string') permissionsSet.add(p);
      });
    } else if (typeof payload.permissions === 'string') {
      payload.permissions.split(',').forEach((p: string) => permissionsSet.add(p.trim()));
    }

    if (typeof payload.scope === 'string') {
      payload.scope.split(' ').forEach((s: string) => {
        const trimmed = s.trim();
        if (trimmed) permissionsSet.add(trimmed);
      });
    }

    if (Array.isArray(payload.authorization?.permissions)) {
      for (const perm of payload.authorization.permissions) {
        if (Array.isArray(perm?.scopes)) {
          perm.scopes.forEach((s: unknown) => {
            if (typeof s === 'string') permissionsSet.add(s);
          });
        }
      }
    }

    const roles = Array.from(rolesSet);
    const isAgent =
      payload.actor_type === 'agent' ||
      payload.type === 'agent' ||
      roles.includes('AI_SALES_AGENT') ||
      roles.includes('AI_ORCHESTRATOR') ||
      subject.startsWith('ai-');

    const actor: ActorIdentity = {
      id: subject,
      type: isAgent ? 'agent' : 'user',
      roles,
      permissions: Array.from(permissionsSet).filter(Boolean),
    };

    return {
      actor,
    };
  }
}
