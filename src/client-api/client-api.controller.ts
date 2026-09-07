import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { RateLimitGuard, UseRateLimit } from '../rate-limit/rate-limit.guard';
import { ClientLinksService } from './client-links.service';
import { BatchShortenDto } from './dto/batch-shorten.dto';

interface ApiAuthenticatedRequest {
  user: User;
}

@Controller('api/v1')
@UseGuards(ApiTokenGuard, RateLimitGuard)
@UseRateLimit('api')
export class ClientApiController {
  constructor(
    private readonly links: ClientLinksService,
    private readonly config: ConfigService,
  ) {}

  @Post('shorten')
  async shorten(@Req() request: ApiAuthenticatedRequest, @Body() body: BatchShortenDto) {
    const links = await this.links.createBatch(request.user.id, body);
    const baseUrl = this.config.getOrThrow<string>('APP_BASE_URL').replace(/\/$/, '');

    return {
      links: links.map((link) => ({
        id: link.id,
        shortCode: link.shortCode,
        shortUrl: `${baseUrl}/${link.shortCode}`,
        originalUrl: link.originalUrl,
        expiresAt: link.expiresAt,
      })),
    };
  }
}
