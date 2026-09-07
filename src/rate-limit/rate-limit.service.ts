import { Injectable } from '@nestjs/common';
import { RedisService } from '../cache/redis.service';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  async consume(scope: string, subject: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const key = `rate-limit:${scope}:${subject}`;
    const { count, ttlSeconds } = await this.redis.incrementWithExpiry(key, windowSeconds);
    const retryAfterSeconds = Math.max(1, ttlSeconds > 0 ? ttlSeconds : windowSeconds);

    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds,
    };
  }
}
