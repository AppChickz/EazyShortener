import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { ApiTokensModule } from './api-tokens/api-tokens.module';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from './cache/cache.module';
import { ClientApiModule } from './client-api/client-api.module';
import { OriginGuard } from './common/origin.guard';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { SafeLogger } from './common/safe-logger';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { LinksController } from './links/links.controller';
import { LinksModule } from './links/links.module';
import { RedirectModule } from './redirect/redirect.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { DashboardController } from './web/dashboard.controller';
import { GuestController } from './web/guest.controller';
import { TokenController } from './web/token.controller';

@Module({
  imports: [
    AppConfigModule,
    ApiTokensModule,
    AuthModule,
    CacheModule,
    ClientApiModule,
    DatabaseModule,
    HealthModule,
    LinksModule,
    RateLimitModule,
    RedirectModule,
  ],
  controllers: [AppController, DashboardController, LinksController, GuestController, TokenController],
  providers: [SafeLogger, { provide: APP_GUARD, useClass: OriginGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
