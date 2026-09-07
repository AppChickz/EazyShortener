import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client;

  constructor(config: ConfigService) {
    this.client = createClient({ url: config.getOrThrow<string>('REDIS_URL') });
  }

  async onModuleInit(): Promise<void> {
    if (!this.client.isOpen) await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) await this.client.quit();
  }

  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async setEx(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.client.setEx(key, ttlSeconds, value);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async incrementWithExpiry(key: string, windowSeconds: number): Promise<{ count: number; ttlSeconds: number }> {
    const result = await this.client.multi().incr(key).ttl(key).exec();
    const count = Number(result[0]);
    let ttlSeconds = Number(result[1]);

    if (count === 1 || ttlSeconds < 0) {
      await this.client.expire(key, windowSeconds);
      ttlSeconds = windowSeconds;
    }

    return { count, ttlSeconds };
  }

  ping(): Promise<string> {
    return this.client.ping();
  }
}
