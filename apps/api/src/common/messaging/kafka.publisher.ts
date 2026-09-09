import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Producer } from 'kafkajs';
import type { OutboxEvent } from '@autonomous-enterprise/contracts';
import { createKafkaProducer, getKafkaConfig } from './messaging.config';

@Injectable()
export class KafkaPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly config = getKafkaConfig();
  private readonly producer?: Producer;

  constructor() {
    this.producer = createKafkaProducer(this.config);
  }

  async onModuleInit(): Promise<void> {
    if (this.producer) await this.producer.connect();
  }

  async publish(event: OutboxEvent): Promise<void> {
    if (!this.producer) return;
    await this.producer.send({
      topic: this.config.topic,
      messages: [{ key: event.aggregateId, value: JSON.stringify(event), headers: { eventType: event.eventType } }]
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.producer) await this.producer.disconnect();
  }
}
