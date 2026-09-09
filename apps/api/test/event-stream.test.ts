import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { EventStreamService } from '../src/common/events/event-stream.service';
import { firstValueFrom, take } from 'rxjs';

describe('Real-time Event Streaming (SSE)', () => {
  let app: INestApplication;
  let eventStreamService: EventStreamService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    eventStreamService = moduleFixture.get(EventStreamService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('should emit and filter events scoped strictly to tenantId', async () => {
    const tenantA = 'tenant-stream-a';
    const tenantB = 'tenant-stream-b';

    const streamA$ = eventStreamService.streamForTenant(tenantA);
    const eventPromiseA = firstValueFrom(streamA$.pipe(take(1)));

    // Emit event for tenant B (should not leak to A)
    eventStreamService.emit({
      action: 'ORDER_CREATED',
      tenantId: tenantB,
      actor: { id: 'user-b', type: 'user', tenantId: tenantB, roles: [], permissions: [] },
      timestamp: new Date().toISOString()
    });

    // Emit event for tenant A
    eventStreamService.emit({
      action: 'ORDER_CREATED',
      tenantId: tenantA,
      actor: { id: 'user-a', type: 'user', tenantId: tenantA, roles: [], permissions: [] },
      timestamp: new Date().toISOString(),
      metadata: { orderId: 'so-123' }
    });

    const receivedEventA = await eventPromiseA;
    expect(receivedEventA.tenantId).toBe(tenantA);
    expect(receivedEventA.action).toBe('ORDER_CREATED');
    expect(receivedEventA.metadata?.orderId).toBe('so-123');
  });
});
