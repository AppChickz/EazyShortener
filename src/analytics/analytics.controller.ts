import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtGuard } from '../auth/jwt.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, normalizeAnalyticsQuery } from './dto/analytics-query.dto';

@Controller('api/links/:linkId/analytics')
@UseGuards(JwtGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  summary(
    @Req() request: { user: User },
    @Param('linkId') linkId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    const normalized = normalizeAnalyticsQuery(query);
    return this.analytics.summary(request.user.id, linkId, normalized.days, normalized.recentLimit);
  }
}
