import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { RateLimitService } from './rate-limit.service';

@Module({
  imports: [CacheModule],
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}
