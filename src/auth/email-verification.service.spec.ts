import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { EmailVerificationService } from './email-verification.service';

function createHarness(ttlSeconds = 86_400) {
  const rows: Array<{ id: string; userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null }> = [];
  let sequence = 0;
  const users = new Map<string, { status: string; emailVerifiedAt: Date | null }>();
  const prisma = {
    emailVerificationToken: {
      create: ({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => {
        const row = { id: `token-${++sequence}`, usedAt: null, ...data };
        rows.push(row);
        return Promise.resolve(row);
      },
      findUnique: ({ where }: { where: { tokenHash: string } }) => {
        const row = rows.find((entry) => entry.tokenHash === where.tokenHash);
        return Promise.resolve(row ? { id: row.id, userId: row.userId } : null);
      },
      updateMany: ({ where, data }: { where: { id: string; usedAt: null; expiresAt: { gt: Date } }; data: { usedAt: Date } }) => {
        const row = rows.find((entry) => entry.id === where.id);
        if (!row || row.usedAt !== null || row.expiresAt <= where.expiresAt.gt) return Promise.resolve({ count: 0 });
        row.usedAt = data.usedAt;
        return Promise.resolve({ count: 1 });
      },
    },
    user: {
      update: ({ where, data }: { where: { id: string }; data: { status: string; emailVerifiedAt: Date } }) => {
        users.set(where.id, data);
        return Promise.resolve({ id: where.id, ...data });
      },
    },
    $transaction: <T>(callback: (tx: unknown) => Promise<T>) => callback(prisma),
  };
  const config = { get: (key: string) => (key === 'EMAIL_VERIFICATION_TTL_SECONDS' ? ttlSeconds : undefined) };
  const apiTokens = { issueInitialIfAbsent: () => Promise.resolve(null) };
  return { service: new EmailVerificationService(prisma as never, config as never, apiTokens as never), rows, users };
}

void test('issues cryptographically random raw tokens while persisting only their hashes with configured TTL', async () => {
  const { service, rows } = createHarness(3_600);
  const now = new Date('2026-08-29T00:00:00.000Z');
  const first = await service.issue('user-1', now);
  const second = await service.issue('user-1', now);

  assert.notEqual(first.rawToken, second.rawToken);
  assert.equal(Buffer.from(first.rawToken, 'base64url').length, 32);
  assert.equal(first.expiresAt.toISOString(), '2026-08-29T01:00:00.000Z');
  assert.equal(rows[0]?.tokenHash, createHash('sha256').update(first.rawToken).digest('hex'));
  assert.notEqual(rows[0]?.tokenHash, first.rawToken);
});

void test('consumes a valid token exactly once', async () => {
  const { service } = createHarness();
  const issued = await service.issue('user-2', new Date('2026-08-29T00:00:00.000Z'));
  const consumedAt = new Date('2026-08-29T00:05:00.000Z');

  assert.equal(await service.consume(issued.rawToken, consumedAt), 'user-2');
  await assert.rejects(service.consume(issued.rawToken, consumedAt), /Invalid or expired verification token/);
});

void test('verifies a valid token, activates the user, and rejects reuse', async () => {
  const { service, users } = createHarness();
  const issued = await service.issue('user-verify', new Date('2026-08-29T00:00:00.000Z'));
  const verifiedAt = new Date('2026-08-29T00:05:00.000Z');

  const verified = await service.verify(issued.rawToken, verifiedAt);
  assert.equal(verified.userId, 'user-verify');
  assert.equal(users.get('user-verify')?.status, 'ACTIVE');
  assert.equal(users.get('user-verify')?.emailVerifiedAt?.toISOString(), verifiedAt.toISOString());
  await assert.rejects(service.verify(issued.rawToken, verifiedAt), /Invalid or expired verification token/);
});

void test('rejects expired and unknown tokens', async () => {
  const { service } = createHarness(60);
  const issued = await service.issue('user-3', new Date('2026-08-29T00:00:00.000Z'));

  await assert.rejects(service.consume(issued.rawToken, new Date('2026-08-29T00:01:01.000Z')), /Invalid or expired verification token/);
  await assert.rejects(service.consume('unknown-token'), /Invalid or expired verification token/);
});
