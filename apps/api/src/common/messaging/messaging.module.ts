import { Module } from '@nestjs/common';
import { KafkaConsumer } from './kafka.consumer';
import { KafkaPublisher } from './kafka.publisher';
import { RedisService } from './redis.service';
import { InMemoryOutboxPersistence } from './outbox.persistence';

export const OUTBOX_PERSISTENCE = Symbol('OUTBOX_PERSISTENCE');

@Module({
  providers: [
    KafkaConsumer,
    KafkaPublisher,
    RedisService,
    { provide: OUTBOX_PERSISTENCE, useClass: InMemoryOutboxPersistence }
  ],
  exports: [KafkaConsumer, KafkaPublisher, RedisService, OUTBOX_PERSISTENCE]
})
export class MessagingModule {}
