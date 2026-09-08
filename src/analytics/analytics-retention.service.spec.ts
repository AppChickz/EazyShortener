import assert from 'node:assert/strict';
import test from 'node:test';
import { AnalyticsRetentionService } from './analytics-retention.service';

void test('cleanup removes events older than configured retention window', async () => {
  let where: unknown;
  const prisma = {
    clickEvent: {
      deleteMany(input: { where: unknown }): Promise<{ count: number }> {
        where = input.where;
        return Promise.resolve({ count: 3 });
      },
    },
  };
  const config = { get: () => 90 };
  const service = new AnalyticsRetentionService(prisma as never, config as never);
  const now = new Date('2026-09-08T00:00:00.000Z');

  assert.equal(await service.cleanup(now), 3);
  assert.deepEqual(where, { clickedAt: { lt: new Date('2026-06-10T00:00:00.000Z') } });
});

void test('cleanup defaults to 90 days when config is absent', async () => {
  let cutoff: Date | undefined;
  const prisma = {
    clickEvent: {
      deleteMany(input: { where: { clickedAt: { lt: Date } } }): Promise<{ count: number }> {
        cutoff = input.where.clickedAt.lt;
        return Promise.resolve({ count: 0 });
      },
    },
  };
  const config = { get: () => undefined };
  const service = new AnalyticsRetentionService(prisma as never, config as never);

  await service.cleanup(new Date('2026-09-08T00:00:00.000Z'));
  assert.equal(cutoff?.toISOString(), '2026-06-10T00:00:00.000Z');
});
