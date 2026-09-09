import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { KeycloakJwtService } from './keycloak-jwt.service';
import { TenantGuard } from './tenant.guard';
import { RbacGuard } from './rbac.guard';

@Module({
  providers: [
    KeycloakJwtService,
    TenantGuard,
    RbacGuard,
    { provide: APP_GUARD, useExisting: TenantGuard },
    { provide: APP_GUARD, useExisting: RbacGuard }
  ],
  exports: [KeycloakJwtService, TenantGuard, RbacGuard]
})
export class AuthModule {}
