import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { RateLimitService } from './rate-limit.service';

export type RateLimitProfile = 'guest' | 'auth' | 'api';
const RATE_LIMIT_PROFILE = 'eazyshortener:rate-limit-profile';

export const UseRateLimit = (profile: RateLimitProfile) => SetMetadata(RATE_LIMIT_PROFILE, profile);

interface RateLimitedRequest {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface RateLimitedResponse {
  setHeader(name: string, value: string | number): void;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimits: RateLimitService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const profile = this.reflector.getAllAndOverride<RateLimitProfile>(RATE_LIMIT_PROFILE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!profile) return true;

    const request = context.switchToHttp().getRequest<RateLimitedRequest>();
    const response = context.switchToHttp().getResponse<RateLimitedResponse>();
    const subject = this.subjectFor(profile, request);
    const { limit, windowSeconds } = this.settingsFor(profile);
    const result = await this.rateLimits.consume(profile, subject, limit, windowSeconds);

    response.setHeader('X-RateLimit-Limit', result.limit);
    response.setHeader('X-RateLimit-Remaining', result.remaining);

    if (!result.allowed) {
      response.setHeader('Retry-After', result.retryAfterSeconds);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          retryAfterSeconds: result.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private settingsFor(profile: RateLimitProfile): { limit: number; windowSeconds: number } {
    if (profile === 'guest') {
      return {
        limit: this.config.getOrThrow<number>('GUEST_RATE_LIMIT_MAX_REQUESTS'),
        windowSeconds: this.config.getOrThrow<number>('GUEST_RATE_LIMIT_WINDOW_SECONDS'),
      };
    }
    if (profile === 'auth') {
      return {
        limit: this.config.getOrThrow<number>('AUTH_RATE_LIMIT_MAX_REQUESTS'),
        windowSeconds: this.config.getOrThrow<number>('AUTH_RATE_LIMIT_WINDOW_SECONDS'),
      };
    }
    return {
      limit: this.config.getOrThrow<number>('API_RATE_LIMIT_MAX_REQUESTS'),
      windowSeconds: this.config.getOrThrow<number>('API_RATE_LIMIT_WINDOW_SECONDS'),
    };
  }

  private subjectFor(profile: RateLimitProfile, request: RateLimitedRequest): string {
    if (profile !== 'api') return request.ip || 'unknown';

    const authorization = request.headers.authorization;
    const raw = typeof authorization === 'string' ? authorization.replace(/^Bearer\s+/i, '').trim() : '';
    return createHash('sha256').update(raw).digest('hex');
  }
}
