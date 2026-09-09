import { Kafka, type Producer } from 'kafkajs';

export interface KafkaConfig {
  brokers: string[];
  clientId: string;
  topic: string;
  groupId: string;
  enabled: boolean;
}

export interface RedisConfig {
  url?: string;
  host: string;
  port: number;
  password?: string;
  enabled: boolean;
}

const asBoolean = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined ? fallback : value.toLowerCase() === 'true';

export const getKafkaConfig = (env: NodeJS.ProcessEnv = process.env): KafkaConfig => ({
  brokers: (env.KAFKA_BROKERS || 'localhost:9092').split(',').map((broker) => broker.trim()).filter(Boolean),
  clientId: env.KAFKA_CLIENT_ID || 'autonomous-enterprise-api',
  topic: env.KAFKA_TOPIC || 'enterprise.events',
  groupId: env.KAFKA_GROUP_ID || 'autonomous-enterprise-workers',
  enabled: asBoolean(env.KAFKA_ENABLED, false)
});

export const getRedisConfig = (env: NodeJS.ProcessEnv = process.env): RedisConfig => ({
  url: env.REDIS_URL,
  host: env.REDIS_HOST || 'localhost',
  port: Number.parseInt(env.REDIS_PORT || '6379', 10),
  password: env.REDIS_PASSWORD,
  enabled: asBoolean(env.REDIS_ENABLED, false)
});

export const createKafkaProducer = (config: KafkaConfig): Producer | undefined => {
  if (!config.enabled) return undefined;
  return new Kafka({ clientId: config.clientId, brokers: config.brokers }).producer();
};
