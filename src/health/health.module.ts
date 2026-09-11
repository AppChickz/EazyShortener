import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { DatabaseModule } from '../database/database.module';
import { HealthController } from './health.controller';

@Module({
  imports: [CacheModule, DatabaseModule],
  controllers: [HealthController],
})
export class HealthModule {}
