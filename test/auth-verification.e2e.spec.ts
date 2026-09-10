import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { startE2eApp } from './e2e-app';

void test('register, verify, login and reject unverified/expired/reused verification tokens', async () => {
  const { app, baseUrl, prisma, mail } = await startE2eApp();
  const marker = randomUUID().replaceAll('-', '');
  const verifiedEmail = `verified-${marker}@example.test`;
  const expiredEmail = `expired-${marker}@example.test`;
  const password = 'E2ePassword!2026';

  const register = async (email: string): Promise<string> => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(response.status, 201, await response.text());
    const entry = mail.verificationUrls.find((item) => item.to === email);
    assert.ok(entry);
    const token = new URL(entry.url).searchParams.get('token');
    assert.ok(token);
    return token;
  };

  const login = (email: string) =>
    fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email, password }),
      redirect: 'manual',
    });

  try {
    const verificationToken = await register(verifiedEmail);

    const unverifiedLogin = await login(verifiedEmail);
    assert.match(await unverifiedLogin.text(), /Invalid email or password/);

    const verification = await fetch(
      `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(verificationToken)}`,
    );
    assert.equal(verification.status, 200, await verification.text());

    const reused = await fetch(`${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(verificationToken)}`);
    assert.ok(reused.status >= 400);

    const verifiedLogin = await login(verifiedEmail);
    assert.match(await verifiedLogin.text(), /Signed in successfully/);
    assert.match(verifiedLogin.headers.get('set-cookie') ?? '', /HttpOnly/i);

    const expiredToken = await register(expiredEmail);
    const expiredUser = await prisma.user.findUniqueOrThrow({ where: { email: expiredEmail } });
    await prisma.emailVerificationToken.updateMany({
      where: { userId: expiredUser.id, usedAt: null },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const expired = await fetch(`${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(expiredToken)}`);
    assert.ok(expired.status >= 400);
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: [verifiedEmail, expiredEmail] } } });
    await app.close();
  }
});
