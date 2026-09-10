import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { LinkCreatedVia, UserStatus } from '@prisma/client';
import { startE2eApp } from './e2e-app';

void test('API token states and batch boundaries enforce auth, limits and atomic rollback', async () => {
  const { app, baseUrl, prisma, apiTokens } = await startE2eApp();
  const marker = randomUUID().replaceAll('-', '');
  const email = `api-${marker}@example.test`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: 'e2e-only',
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  const postBatch = (rawToken: string, links: Array<{ url: string; customAlias?: string }>) =>
    fetch(`${baseUrl}/api/v1/shorten`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${rawToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ links }),
    });

  try {
    const valid = await apiTokens.create(user.id, { name: 'valid' });
    const one = await postBatch(valid.rawToken, [{ url: `https://example.com/api-one/${marker}` }]);
    assert.equal(one.status, 201, await one.text());

    const tenPayload = Array.from({ length: 10 }, (_, index) => ({
      url: `https://example.com/api-ten/${marker}/${index}`,
    }));
    const ten = await postBatch(valid.rawToken, tenPayload);
    assert.equal(ten.status, 201);
    const tenBody = (await ten.json()) as { links: unknown[] };
    assert.equal(tenBody.links.length, 10);

    const eleven = await postBatch(
      valid.rawToken,
      Array.from({ length: 11 }, (_, index) => ({ url: `https://example.com/api-eleven/${marker}/${index}` })),
    );
    assert.ok(eleven.status >= 400);

    const revoked = await apiTokens.create(user.id, { name: 'revoked' });
    await apiTokens.revoke(user.id, revoked.id);
    const revokedResponse = await postBatch(revoked.rawToken, [{ url: `https://example.com/revoked/${marker}` }]);
    assert.equal(revokedResponse.status, 401);

    const expired = await apiTokens.create(user.id, {
      name: 'expired',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await prisma.apiToken.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    const expiredResponse = await postBatch(expired.rawToken, [{ url: `https://example.com/expired-token/${marker}` }]);
    assert.equal(expiredResponse.status, 401);

    const collisionAlias = `collision-${marker.slice(0, 8)}`;
    const firstAlias = `first-${marker.slice(0, 8)}`;
    await prisma.link.create({
      data: {
        userId: user.id,
        shortCode: collisionAlias,
        originalUrl: `https://example.com/existing/${marker}`,
        isActive: true,
        createdVia: LinkCreatedVia.API,
      },
    });
    const rollbackUrl = `https://example.com/rollback-first/${marker}`;
    const rollback = await postBatch(valid.rawToken, [
      { url: rollbackUrl, customAlias: firstAlias },
      { url: `https://example.com/rollback-second/${marker}`, customAlias: collisionAlias },
    ]);
    assert.ok(rollback.status >= 400);
    assert.equal(await prisma.link.count({ where: { originalUrl: rollbackUrl } }), 0);
  } finally {
    await prisma.link.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await app.close();
  }
});
