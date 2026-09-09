import { Inject, Injectable, Optional } from '@nestjs/common';
import type { OutboxEvent } from '@autonomous-enterprise/contracts';
import { KafkaPublisher } from '../../common/messaging/kafka.publisher';
import { OUTBOX_PERSISTENCE } from '../../common/messaging/messaging.module';
import type { OutboxPersistence } from '../../common/messaging/outbox.persistence';

@Injectable()
export class OutboxService {
  constructor(
    @Optional() @Inject(OUTBOX_PERSISTENCE) private readonly persistence: OutboxPersistence,
    @Optional() private readonly publisher: KafkaPublisher
  ) {}

  publish<T = unknown>(
    aggregateTypeOrObj: string | { aggregateType: string; aggregateId: string; eventType: string; payload: T },
    aggregateId?: string,
    eventType?: string,
    payload?: T
  ): OutboxEvent<T> {
    let aggType: string;
    let aggId: string;
    let evtType: string;
    let evtPayload: T;

    if (typeof aggregateTypeOrObj === 'object' && aggregateTypeOrObj !== null) {
      aggType = aggregateTypeOrObj.aggregateType;
      aggId = aggregateTypeOrObj.aggregateId;
      evtType = aggregateTypeOrObj.eventType;
      evtPayload = aggregateTypeOrObj.payload;
    } else {
      aggType = aggregateTypeOrObj;
      aggId = aggregateId!;
      evtType = eventType!;
      evtPayload = payload!;
    }

    const event: OutboxEvent<T> = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      aggregateType: aggType,
      aggregateId: aggId,
      eventType: evtType,
      payload: evtPayload,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    void this.persistence?.append(event);
    return event;
  }

  async markAsPublished(eventId: string): Promise<void> {
    await this.persistence?.markPublished(eventId, new Date().toISOString());
  }

  getEvents(): OutboxEvent[] {
    const events = this.persistence?.find() ?? [];
    if (events instanceof Promise) return [];
    return events;
  }

  getPendingEvents(): OutboxEvent[] {
    const events = this.persistence?.findPending() ?? [];
    if (events instanceof Promise) return [];
    return events;
  }

  async publishPending(): Promise<number> {
    const events = await this.persistence?.findPending();
    if (!events?.length) return 0;
    let count = 0;
    for (const event of events) {
      if (this.publisher) {
        await this.publisher.publish(event);
      }
      await this.markAsPublished(event.id);
      count++;
    }
    return count;
  }
}
