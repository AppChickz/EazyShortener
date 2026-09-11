import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { RedisService } from '../cache/redis.service';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('live')
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async readiness(): Promise<{ status: 'ok'; checks: { postgres: 'ok'; redis: 'ok' } }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const redisStatus = await this.redis.ping();
      if (redisStatus !== 'PONG') throw new Error('Redis readiness check failed');

      return {
        status: 'ok',
        checks: {
          postgres: 'ok',
          redis: 'ok',
        },
      };
    } catch {
      throw new ServiceUnavailableException('Application dependencies are not ready');
    }
  }
}
