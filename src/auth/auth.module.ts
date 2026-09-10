import { Module } from '@nestjs/common';
import { ApiTokensModule } from '../api-tokens/api-tokens.module';
import { DatabaseModule } from '../database/database.module';
import { AppKeyService } from '../security/app-key.service';
import { MailModule } from '../mail/mail.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { WebAuthController } from '../web/auth.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { JwtGuard } from './jwt.guard';
import { JwtService } from './jwt.service';
import { JwtStrategy } from './jwt.strategy';
import { PasswordService } from './password.service';

@Module({
  imports: [ApiTokensModule, DatabaseModule, MailModule, RateLimitModule],
  controllers: [AuthController, WebAuthController],
  providers: [AppKeyService, AuthService, EmailVerificationService, JwtGuard, JwtService, JwtStrategy, PasswordService],
  exports: [AuthService, EmailVerificationService, JwtGuard, JwtService, JwtStrategy],
})
export class AuthModule {}
