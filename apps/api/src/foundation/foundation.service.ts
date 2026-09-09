import { Injectable } from '@nestjs/common';
import type { ApiResponse, RequestContext } from '@autonomous-enterprise/contracts';
import { RequestContextStorage, TenantContextStorage } from '@autonomous-enterprise/shared';

@Injectable()
export class FoundationService {
  getTenantProfile(): ApiResponse<RequestContext | undefined> {
    const context = RequestContextStorage.getContext() || TenantContextStorage.getContext();
    return {
      success: true,
      data: context,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }

  executeUserAction(): ApiResponse<{ status: string }> {
    return {
      success: true,
      data: { status: 'user action completed successfully' },
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }

  executeAgentAction(): ApiResponse<{ status: string }> {
    const actor = RequestContextStorage.getActor() || TenantContextStorage.getActor();
    return {
      success: true,
      data: { status: `agent action executed by ${actor?.id}` },
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }
}
