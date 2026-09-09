import { Controller, Get, Inject } from '@nestjs/common';
import { Role, type ApiResponse } from '@autonomous-enterprise/contracts';
import { TenantContextStorage } from '@autonomous-enterprise/shared';
import { RequirePermissions, Roles } from '../auth/rbac.decorators';
import { Audit } from '../audit/audit.decorators';
import { ObservabilityService } from './observability.service';
import type { ObservabilitySnapshot } from './observability.types';

@Controller('api/v1/observability')
export class ObservabilityController {
  constructor(
    @Inject(ObservabilityService) private readonly observabilityService: ObservabilityService
  ) {}

  @Get('snapshot')
  @Roles(Role.TENANT_ADMIN, Role.OPERATOR, Role.AUDITOR, Role.SUPER_ADMIN)
  @RequirePermissions('observability:read')
  @Audit('GET_OBSERVABILITY_SNAPSHOT')
  async getSnapshot(): Promise<ApiResponse<ObservabilitySnapshot>> {
    const snapshot = await this.observabilityService.getSnapshot();
    return {
      success: true,
      data: snapshot,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }
}
