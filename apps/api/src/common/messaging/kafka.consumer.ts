import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, type Consumer, type EachMessagePayload } from 'kafkajs';
import { getKafkaConfig } from './messaging.config';

export type KafkaMessageHandler = (payload: EachMessagePayload) => Promise<void> | void;

@Injectable()
export class KafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly config = getKafkaConfig();
  private readonly consumer?: Consumer;
  private handler?: KafkaMessageHandler;

  constructor() {
    if (this.config.enabled) {
      this.consumer = new Kafka({ clientId: `${this.config.clientId}-consumer`, brokers: this.config.brokers }).consumer({ groupId: this.config.groupId });
    }
  }

  setHandler(handler: KafkaMessageHandler): void {
    this.handler = handler;
  }

  async onModuleInit(): Promise<void> {
    if (!this.consumer) return;
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.config.topic, fromBeginning: false });
    await this.consumer.run({ eachMessage: async (payload) => this.handler?.(payload) });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.consumer) await this.consumer.disconnect();
  }
}
