import type { OutboxEvent } from '@autonomous-enterprise/contracts';

export interface OutboxPersistence {
  append<T>(event: OutboxEvent<T>): Promise<void> | void;
  find(): Promise<OutboxEvent[]> | OutboxEvent[];
  findPending(): Promise<OutboxEvent[]> | OutboxEvent[];
  markPublished(eventId: string, publishedAt: string): Promise<void> | void;
  markFailed?(eventId: string): Promise<void> | void;
}

export class InMemoryOutboxPersistence implements OutboxPersistence {
  private readonly events: OutboxEvent[] = [];

  append<T>(event: OutboxEvent<T>): void {
    this.events.push(event as OutboxEvent);
  }

  find(): OutboxEvent[] {
    return this.events.map((event) => ({ ...event }));
  }

  findPending(): OutboxEvent[] {
    return this.find().filter((event) => event.status === 'PENDING');
  }

  markPublished(eventId: string, publishedAt: string): void {
    const event = this.events.find((candidate) => candidate.id === eventId);
    if (event) {
      event.status = 'PUBLISHED';
      event.publishedAt = publishedAt;
    }
  }

  markFailed(eventId: string): void {
    const event = this.events.find((candidate) => candidate.id === eventId);
    if (event) event.status = 'FAILED';
  }
}
