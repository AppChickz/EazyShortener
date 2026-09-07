import { Module } from '@nestjs/common';
import { ApiTokensModule } from '../api-tokens/api-tokens.module';
import { DatabaseModule } from '../database/database.module';
import { LinksModule } from '../links/links.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { ClientApiController } from './client-api.controller';
import { ClientLinksService } from './client-links.service';

@Module({
  imports: [ApiTokensModule, DatabaseModule, LinksModule, RateLimitModule],
  controllers: [ClientApiController],
  providers: [ClientLinksService],
  exports: [ClientLinksService],
})
export class ClientApiModule {}
