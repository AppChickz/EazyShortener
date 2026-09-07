import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';

@Module({
  imports: [CacheModule],
  providers: [RateLimitGuard, RateLimitService],
  exports: [RateLimitGuard, RateLimitService],
})
export class RateLimitModule {}
