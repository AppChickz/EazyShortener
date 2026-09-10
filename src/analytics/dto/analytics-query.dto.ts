import { IsOptional, IsString } from 'class-validator';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  days?: string;

  @IsOptional()
  @IsString()
  recentLimit?: string;
}

export function normalizeAnalyticsQuery(input: AnalyticsQueryDto): { days: number; recentLimit: number } {
  const parsedDays = Number.parseInt(input.days ?? '30', 10);
  const parsedRecent = Number.parseInt(input.recentLimit ?? '20', 10);
  return {
    days: Math.min(Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 30, 90),
    recentLimit: Math.min(Number.isFinite(parsedRecent) && parsedRecent > 0 ? parsedRecent : 20, 100),
  };
}
