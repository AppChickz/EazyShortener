import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { AppKeyService } from '../security/app-key.service';

export interface RedirectAnalyticsInput {
  ip?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appKeys: AppKeyService,
  ) {}

  async record(shortCode: string, input: RedirectAnalyticsInput): Promise<void> {
    try {
      const link = await this.prisma.link.findUnique({ where: { shortCode }, select: { id: true } });
      if (!link) return;

      await this.prisma.clickEvent.create({
        data: {
          linkId: link.id,
          referrerHost: this.referrerHost(input.referrer),
          userAgent: input.userAgent?.slice(0, 2048) || null,
          ipHash: input.ip ? createHmac('sha256', this.appKeys.ipHashKey()).update(input.ip).digest('hex') : null,
        },
      });
    } catch {
      // Analytics is best-effort and must never break redirect handling.
    }
  }

  private referrerHost(value?: string | null): string | null {
    if (!value) return null;
    try {
      return new URL(value).hostname || null;
    } catch {
      return null;
    }
  }
}
