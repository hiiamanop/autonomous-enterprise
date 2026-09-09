import { describe, expect, it } from 'vitest';
import { getKafkaConfig, getRedisConfig } from '../src/common/messaging/messaging.config';
import { InMemoryOutboxPersistence } from '../src/common/messaging/outbox.persistence';

const event = {
  id: 'event-1',
  aggregateType: 'order',
  aggregateId: 'order-1',
  eventType: 'order.created',
  payload: { amount: 10 },
  status: 'PENDING' as const,
  createdAt: '2026-01-01T00:00:00.000Z'
};

describe('Messaging primitives', () => {
  it('uses safe disabled defaults and explicit environment configuration', () => {
    expect(getKafkaConfig({})).toMatchObject({ enabled: false, brokers: ['localhost:9092'] });
    expect(getRedisConfig({})).toMatchObject({ enabled: false, host: 'localhost', port: 6379 });
    expect(getKafkaConfig({ KAFKA_ENABLED: 'true', KAFKA_BROKERS: 'broker-a:9092,broker-b:9092' })).toMatchObject({ enabled: true, brokers: ['broker-a:9092', 'broker-b:9092'] });
  });

  it('persists, filters, and publishes outbox state transitions', async () => {
    const persistence = new InMemoryOutboxPersistence();
    await persistence.append(event);
    expect(await persistence.findPending()).toEqual([event]);
    await persistence.markPublished(event.id, '2026-01-01T00:01:00.000Z');
    expect(await persistence.findPending()).toEqual([]);
    expect((await persistence.find())[0]).toMatchObject({ status: 'PUBLISHED', publishedAt: '2026-01-01T00:01:00.000Z' });
  });
});
