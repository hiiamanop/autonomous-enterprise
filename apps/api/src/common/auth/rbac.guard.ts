import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContextStorage, hasPermission, hasRole } from '@autonomous-enterprise/shared';
import { Role } from '@autonomous-enterprise/contracts';
import { ROLES_KEY, PERMISSIONS_KEY } from './rbac.decorators';

@Injectable()
export class RbacGuard implements CanActivate {
  private readonly reflector: Reflector;

  constructor(@Optional() reflector?: Reflector) {
    this.reflector = reflector || new Reflector();
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<(Role | string)[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const actor = req.actor || TenantContextStorage.getActor();
    if (!actor) {
      throw new UnauthorizedException('Actor identity is missing');
    }

    if (requiredRoles && requiredRoles.length > 0) {
      const hasAnyRole = requiredRoles.some((role) => hasRole(actor, role));
      if (!hasAnyRole) {
        throw new ForbiddenException(
          `Actor [${actor.id}] with roles [${actor.roles.join(', ')}] does not have required roles [${requiredRoles.join(', ')}]`
        );
      }
    }

    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasAllPermissions = requiredPermissions.every((perm) => hasPermission(actor, perm));
      if (!hasAllPermissions) {
        throw new ForbiddenException(
          `Actor [${actor.id}] does not have required permissions [${requiredPermissions.join(', ')}]`
        );
      }
    }

    return true;
  }
}
