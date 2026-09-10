import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { LinkCreatedVia, UserStatus } from '@prisma/client';
import { startE2eApp } from './e2e-app';

void test('ownership is enforced and redirect cache is invalidated on owner update', async () => {
  const { app, baseUrl, prisma, redis, jwt } = await startE2eApp();
  const marker = randomUUID().replaceAll('-', '');
  const ownerEmail = `owner-${marker}@example.test`;
  const otherEmail = `other-${marker}@example.test`;

  const [owner, other] = await Promise.all([
    prisma.user.create({
      data: {
        email: ownerEmail,
        passwordHash: 'e2e-only',
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        email: otherEmail,
        passwordHash: 'e2e-only',
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    }),
  ]);

  const shortCode = `cache${marker.slice(0, 7)}`;
  const firstUrl = `https://example.com/cache-old/${marker}`;
  const secondUrl = `https://example.com/cache-new/${marker}`;
  const link = await prisma.link.create({
    data: {
      userId: owner.id,
      shortCode,
      originalUrl: firstUrl,
      isActive: true,
      createdVia: LinkCreatedVia.USER_WEB,
    },
  });

  const ownerJwt = jwt.sign(owner);
  const otherJwt = jwt.sign(other);
  const patch = (token: string, originalUrl: string) =>
    fetch(`${baseUrl}/api/links/${link.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ originalUrl }),
    });

  try {
    const firstRedirect = await fetch(`${baseUrl}/${shortCode}`, { redirect: 'manual' });
    assert.equal(firstRedirect.status, 302);
    assert.equal(firstRedirect.headers.get('location'), firstUrl);
    assert.equal(redis.values.get(`redirect:${shortCode}`), firstUrl);

    const cachedRedirect = await fetch(`${baseUrl}/${shortCode}`, { redirect: 'manual' });
    assert.equal(cachedRedirect.status, 302);
    assert.equal(cachedRedirect.headers.get('location'), firstUrl);

    const denied = await patch(otherJwt, secondUrl);
    assert.ok(denied.status >= 400);
    assert.equal((await prisma.link.findUniqueOrThrow({ where: { id: link.id } })).originalUrl, firstUrl);

    const updated = await patch(ownerJwt, secondUrl);
    assert.equal(updated.status, 200, await updated.text());
    assert.ok(redis.deleted.includes(`redirect:${shortCode}`));
    assert.equal(redis.values.has(`redirect:${shortCode}`), false);

    const refreshedRedirect = await fetch(`${baseUrl}/${shortCode}`, { redirect: 'manual' });
    assert.equal(refreshedRedirect.status, 302);
    assert.equal(refreshedRedirect.headers.get('location'), secondUrl);
    assert.equal(redis.values.get(`redirect:${shortCode}`), secondUrl);
  } finally {
    await prisma.link.deleteMany({ where: { userId: { in: [owner.id, other.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
    await app.close();
  }
});
