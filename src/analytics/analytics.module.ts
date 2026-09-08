import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { AppKeyService } from '../security/app-key.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AppKeyService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
