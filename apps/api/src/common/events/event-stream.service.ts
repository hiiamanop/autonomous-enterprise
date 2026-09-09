import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import Redis from 'ioredis';

export interface EventStreamEvent {
  action: string;
  tenantId: string;
  actor: unknown;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class EventStreamService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventStreamService.name);
  private readonly events$ = new Subject<EventStreamEvent>();
  private publisherClient: Redis | null = null;
  private subscriberClient: Redis | null = null;
  private isRedisConnected = false;
  private readonly channelName = 'autonomous-enterprise:events';

  onModuleInit(): void {
    this.initializeRedis();
  }

  private initializeRedis(): void {
    if (process.env.NODE_ENV === 'test' && !process.env.REDIS_ENABLED_TEST) {
      this.isRedisConnected = false;
      return;
    }

    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD || undefined;

    try {
      this.publisherClient = new Redis({
        host,
        port,
        password,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null
      });

      this.subscriberClient = new Redis({
        host,
        port,
        password,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null
      });

      this.publisherClient.on('error', () => {
        this.isRedisConnected = false;
      });

      this.subscriberClient.on('error', () => {
        this.isRedisConnected = false;
      });

      this.subscriberClient.on('message', (channel: string, message: string) => {
        if (channel === this.channelName) {
          try {
            const event = JSON.parse(message) as EventStreamEvent;
            this.events$.next(event);
          } catch (e) {}
        }
      });

      Promise.all([this.publisherClient.connect(), this.subscriberClient.connect()])
        .then(() => {
          return this.subscriberClient?.subscribe(this.channelName);
        })
        .then(() => {
          this.isRedisConnected = true;
          this.logger.log(`Redis Pub/Sub live streaming connected on channel [${this.channelName}]`);
        })
        .catch(() => {
          this.isRedisConnected = false;
          this.logger.warn('Redis Pub/Sub unavailable; running EventStreamService in resilient in-memory mode');
        });
    } catch {
      this.isRedisConnected = false;
    }
  }

  emit(event: EventStreamEvent): void {
    if (this.isRedisConnected && this.publisherClient) {
      this.publisherClient.publish(this.channelName, JSON.stringify(event)).catch(() => {
        this.events$.next(event);
      });
    } else {
      this.events$.next(event);
    }
  }

  emitAuditEvent(event: Omit<EventStreamEvent, 'timestamp'> & { timestamp?: string }): void {
    this.emit({ ...event, timestamp: event.timestamp || new Date().toISOString() });
  }

  emitOutboxEvent(event: {
    action: string;
    tenantId: string;
    actor?: unknown;
    timestamp?: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.emit({
      ...event,
      actor: event.actor || { id: 'system', type: 'service' },
      timestamp: event.timestamp || new Date().toISOString()
    });
  }

  streamForTenant(tenantId: string): Observable<EventStreamEvent> {
    return new Observable<EventStreamEvent>((subscriber) => {
      const subscription = this.events$.subscribe((event) => {
        if (!tenantId || event.tenantId === tenantId || event.tenantId === 'all') {
          subscriber.next(event);
        }
      });

      return () => subscription.unsubscribe();
    });
  }

  buildConnectionHandshake(tenantId: string): EventStreamEvent {
    return {
      action: 'STREAM_CONNECTED',
      tenantId,
      actor: { id: 'event-stream-service', type: 'system' },
      timestamp: new Date().toISOString(),
      metadata: {
        redisPubSub: this.isRedisConnected,
        channel: this.channelName,
        connectedAt: new Date().toISOString()
      }
    };
  }

  onModuleDestroy(): void {
    this.events$.complete();
    if (this.subscriberClient) {
      this.subscriberClient.disconnect();
    }
    if (this.publisherClient) {
      this.publisherClient.disconnect();
    }
  }
}
