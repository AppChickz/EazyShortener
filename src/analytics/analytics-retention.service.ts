import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

const DAY_MS = 86_400_000;

@Injectable()
export class AnalyticsRetentionService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.cleanup(), DAY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async cleanup(now = new Date()): Promise<number> {
    const retentionDays = this.config.get<number>('ANALYTICS_RETENTION_DAYS') ?? 90;
    const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
    const result = await this.prisma.clickEvent.deleteMany({ where: { clickedAt: { lt: cutoff } } });
    return result.count;
  }
}
