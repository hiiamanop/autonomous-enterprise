import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContextStorage } from '@autonomous-enterprise/shared';
import type { ActorIdentity, TenantContext } from '@autonomous-enterprise/contracts';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantContext || TenantContextStorage.getContext();
  }
);

export const CurrentTenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantContext?.tenantId || TenantContextStorage.getTenantId();
  }
);

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActorIdentity | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.actor || TenantContextStorage.getActor();
  }
);
