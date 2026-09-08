import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { AnalyticsService, RedirectAnalyticsInput } from '../analytics/analytics.service';
import { RedirectCacheService } from '../cache/redirect-cache.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RedirectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedirectCacheService,
    private readonly analytics: AnalyticsService,
  ) {}

  async resolve(shortCode: string, analyticsInput: RedirectAnalyticsInput = {}): Promise<string> {
    const cached = await this.cache.get(shortCode);
    if (cached) {
      await this.analytics.record(shortCode, analyticsInput);
      return cached;
    }

    const link = await this.prisma.link.findUnique({
      where: { shortCode },
      select: {
        originalUrl: true,
        expiresAt: true,
        isActive: true,
      },
    });

    if (!link || !link.isActive) {
      throw new NotFoundException();
    }

    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
      throw new GoneException();
    }

    await this.cache.set(shortCode, link.originalUrl, link.expiresAt);
    await this.analytics.record(shortCode, analyticsInput);
    return link.originalUrl;
  }
}
