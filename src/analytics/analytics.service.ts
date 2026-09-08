import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { AppKeyService } from '../security/app-key.service';

export interface RedirectAnalyticsInput {
  ip?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
}

export interface AnalyticsSummary {
  totalClicks: number;
  clicksPerDay: Array<{ date: string; clicks: number }>;
  recentClicks: Array<{ clickedAt: Date; referrerHost: string | null }>;
  topReferrers: Array<{ referrerHost: string; clicks: number }>;
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

  async summary(
    userId: string,
    linkId: string,
    days: number,
    recentLimit: number,
  ): Promise<AnalyticsSummary> {
    const link = await this.prisma.link.findFirst({ where: { id: linkId, userId }, select: { id: true } });
    if (!link) throw new Error('Link not found');

    const since = new Date(Date.now() - days * 86_400_000);
    const [totalClicks, dailyEvents, recentClicks, referrers] = await Promise.all([
      this.prisma.clickEvent.count({ where: { linkId } }),
      this.prisma.clickEvent.findMany({ where: { linkId, clickedAt: { gte: since } }, select: { clickedAt: true } }),
      this.prisma.clickEvent.findMany({
        where: { linkId },
        orderBy: { clickedAt: 'desc' },
        take: recentLimit,
        select: { clickedAt: true, referrerHost: true },
      }),
      this.prisma.clickEvent.groupBy({
        by: ['referrerHost'],
        where: { linkId, referrerHost: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { referrerHost: 'desc' } },
        take: 10,
      }),
    ]);

    const perDay = new Map<string, number>();
    for (const event of dailyEvents) {
      const date = event.clickedAt.toISOString().slice(0, 10);
      perDay.set(date, (perDay.get(date) ?? 0) + 1);
    }

    return {
      totalClicks,
      clicksPerDay: [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, clicks]) => ({ date, clicks })),
      recentClicks,
      topReferrers: referrers
        .filter((item): item is typeof item & { referrerHost: string } => item.referrerHost !== null)
        .map((item) => ({ referrerHost: item.referrerHost, clicks: item._count._all })),
    };
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
