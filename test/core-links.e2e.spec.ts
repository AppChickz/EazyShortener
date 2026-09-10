import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { LinkCreatedVia } from '@prisma/client';
import { startE2eApp } from './e2e-app';

void test('guest shorten redirects and expired/inactive links return 410/404', async () => {
  const { app, baseUrl, prisma } = await startE2eApp();
  const marker = randomUUID();
  const guestUrl = `https://example.com/e2e-core/${marker}`;
  const expiredCode = `exp${marker.replaceAll('-', '').slice(0, 8)}`;
  const inactiveCode = `off${marker.replaceAll('-', '').slice(0, 8)}`;

  try {
    const form = new URLSearchParams({ originalUrl: guestUrl, expiration: 'never' });
    const shortenResponse = await fetch(`${baseUrl}/shorten`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
      redirect: 'manual',
    });
    assert.equal(shortenResponse.status, 201);

    const guestLink = await prisma.link.findFirstOrThrow({ where: { originalUrl: guestUrl } });
    const redirectResponse = await fetch(`${baseUrl}/${guestLink.shortCode}`, { redirect: 'manual' });
    assert.equal(redirectResponse.status, 302, await redirectResponse.text());
    assert.equal(redirectResponse.headers.get('location'), guestUrl);

    await prisma.link.create({
      data: {
        shortCode: expiredCode,
        originalUrl: `https://example.com/expired/${marker}`,
        expiresAt: new Date(Date.now() - 60_000),
        isActive: true,
        createdVia: LinkCreatedVia.GUEST_WEB,
      },
    });
    const expiredResponse = await fetch(`${baseUrl}/${expiredCode}`, { redirect: 'manual' });
    assert.equal(expiredResponse.status, 410);

    await prisma.link.create({
      data: {
        shortCode: inactiveCode,
        originalUrl: `https://example.com/inactive/${marker}`,
        isActive: false,
        createdVia: LinkCreatedVia.GUEST_WEB,
      },
    });
    const inactiveResponse = await fetch(`${baseUrl}/${inactiveCode}`, { redirect: 'manual' });
    assert.equal(inactiveResponse.status, 404);
  } finally {
    await prisma.link.deleteMany({
      where: {
        OR: [{ originalUrl: guestUrl }, { shortCode: expiredCode }, { shortCode: inactiveCode }],
      },
    });
    await app.close();
  }
});
