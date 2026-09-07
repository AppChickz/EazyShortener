import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { RateLimitGuard, UseRateLimit } from '../rate-limit/rate-limit.guard';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { EmailVerificationService } from './email-verification.service';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly emailVerification: EmailVerificationService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  @Get('verify-email')
  @UseGuards(RateLimitGuard)
  @UseRateLimit('auth')
  async verifyEmail(@Query('token') token: string): Promise<{ verified: true }> {
    await this.emailVerification.verify(token);
    return { verified: true };
  }

  @Post('register')
  @UseGuards(RateLimitGuard)
  @UseRateLimit('auth')
  async register(@Body() input: RegisterDto): Promise<{ id: string; email: string; status: string }> {
    const user = await this.auth.register(input);
    const { rawToken } = await this.emailVerification.issue(user.id);
    const verificationUrl = new URL('/api/auth/verify-email', this.config.getOrThrow<string>('APP_BASE_URL'));
    verificationUrl.searchParams.set('token', rawToken);

    await this.mail.sendVerificationEmail(user.email, verificationUrl.toString());

    return {
      id: user.id,
      email: user.email,
      status: user.status,
    };
  }
}
