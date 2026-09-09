import { Controller, Headers, MessageEvent, Query, Sse } from '@nestjs/common';
import { TenantContextStorage } from '@autonomous-enterprise/shared';
import { Observable, map, startWith } from 'rxjs';
import { Public } from '../auth/tenant.guard';
import { EventStreamService, type EventStreamEvent } from './event-stream.service';

@Controller('api/v1/events')
export class EventStreamController {
  constructor(private readonly eventStreamService: EventStreamService) {}

  @Public()
  @Sse('stream')
  stream(@Headers('x-tenant-id') tenantHeader?: string, @Query('tenantId') queryTenant?: string): Observable<MessageEvent> {
    const tenantId = tenantHeader || queryTenant || TenantContextStorage.getTenantId() || 'system';
    return this.eventStreamService.streamForTenant(tenantId).pipe(
      startWith(this.eventStreamService.buildConnectionHandshake(tenantId)),
      map((event: EventStreamEvent) => ({ data: event }))
    );
  }
}
