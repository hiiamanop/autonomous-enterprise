import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextStorage, RequestContextStorage } from '@autonomous-enterprise/shared';
import type { ActorIdentity, RequestContext, TenantContext } from '@autonomous-enterprise/contracts';

declare global {
  namespace Express {
    interface Request {
      tenantContext?: RequestContext;
      actor?: ActorIdentity;
    }
  }
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const actorIdHeader = req.headers['x-actor-id'];
    const actorTypeHeader = req.headers['x-actor-type'];
    const actorRolesHeader = req.headers['x-actor-roles'];
    const actorPermissionsHeader = req.headers['x-actor-permissions'];
    const requestIdHeader = req.headers['x-request-id'];

    const actorId = typeof actorIdHeader === 'string' && actorIdHeader.trim() !== '' ? actorIdHeader : 'anonymous';
    const actorType = actorTypeHeader === 'agent' ? 'agent' : 'user';

    const roles = typeof actorRolesHeader === 'string'
      ? actorRolesHeader.split(',').map((r) => r.trim()).filter(Boolean)
      : ['ADMIN', 'TENANT_ADMIN', 'OPERATOR', 'SUPER_ADMIN'];

    const permissions = typeof actorPermissionsHeader === 'string'
      ? actorPermissionsHeader.split(',').map((p) => p.trim()).filter(Boolean)
      : ['*'];

    const requestId =
      typeof requestIdHeader === 'string'
        ? requestIdHeader
        : `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const actor: ActorIdentity = {
      id: actorId,
      type: actorType,
      roles,
      permissions
    };

    const context: RequestContext = {
      actor,
      requestId
    };

    req.tenantContext = context;
    req.actor = actor;

    res.setHeader('x-request-id', requestId);

    RequestContextStorage.run(context, () => {
      next();
    });
  }
}
