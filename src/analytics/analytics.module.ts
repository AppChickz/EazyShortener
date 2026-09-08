import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AppKeyService } from '../security/app-key.service';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [DatabaseModule],
  providers: [AnalyticsService, AppKeyService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
