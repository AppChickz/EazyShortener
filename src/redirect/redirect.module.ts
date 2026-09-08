import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { DatabaseModule } from '../database/database.module';
import { RedirectController } from './redirect.controller';
import { RedirectService } from './redirect.service';

@Module({
  imports: [AnalyticsModule, DatabaseModule],
  controllers: [RedirectController],
  providers: [RedirectService],
})
export class RedirectModule {}
