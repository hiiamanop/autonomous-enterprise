import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
  SetMetadata,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContextStorage, TenantContextStorage } from '@autonomous-enterprise/shared';
import { KeycloakJwtService } from './keycloak-jwt.service';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly reflector: Reflector;
  private readonly jwtService: KeycloakJwtService;

  constructor(
    @Optional() reflector: Reflector,
    @Inject(KeycloakJwtService) jwtService: KeycloakJwtService
  ) {
    this.reflector = reflector || new Reflector();
    this.jwtService = jwtService;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7).trim()
        : null;

    if (token) {
      const verified = await this.jwtService.verifyToken(token);
      if (verified?.actor) {
        req.actor = verified.actor;
        req.tenantContext = {
          actor: verified.actor,
          requestId: req.headers['x-request-id'] || `req_${Date.now()}`
        };
        return true;
      }
    }

    if (!token && process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('Authentication token is required');
    }

    if (!req.actor) {
      req.actor = {
        id: (req.headers['x-actor-id'] as string) || 'anonymous',
        type: req.headers['x-actor-type'] === 'agent' ? 'agent' : 'user',
        roles: ['ADMIN', 'TENANT_ADMIN', 'OPERATOR', 'SUPER_ADMIN'],
        permissions: ['*']
      };
      req.tenantContext = {
        actor: req.actor,
        requestId: req.headers['x-request-id'] || `req_${Date.now()}`
      };
    }

    return true;
  }
}
