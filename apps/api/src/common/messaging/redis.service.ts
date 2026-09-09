import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import type { Redis as RedisClient } from 'ioredis';
import { getRedisConfig } from './messaging.config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client?: RedisClient;

  async onModuleInit(): Promise<void> {
    const config = getRedisConfig();
    if (!config.enabled) return;
    this.client = config.url ? new Redis(config.url) : new Redis({ host: config.host, port: config.port, password: config.password });
  }

  async get(key: string): Promise<string | null> {
    return this.client?.get(key) ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
      return;
    }
    await this.client.set(key, value);
  }

  isEnabled(): boolean {
    return !!this.client;
  }

  async acquireLock(key: string, ttlMs: number): Promise<string | null> {
    if (!this.client) return null;
    const token = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const result = await this.client.set(key, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? token : null;
  }

  async releaseLock(key: string, token: string): Promise<void> {
    if (!this.client) return;
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await this.client.eval(script, 1, key, token);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) await this.client.quit();
  }
}
