import assert from 'node:assert/strict';
import test from 'node:test';
import { startE2eApp } from './e2e-app';

void test('health endpoints report liveness and dependency readiness', async () => {
  const context = await startE2eApp();

  try {
    const live = await fetch(`${context.baseUrl}/health/live`);
    assert.equal(live.status, 200);
    assert.deepEqual(await live.json(), { status: 'ok' });

    const ready = await fetch(`${context.baseUrl}/health/ready`);
    assert.equal(ready.status, 200);
    assert.deepEqual(await ready.json(), {
      status: 'ok',
      checks: { postgres: 'ok', redis: 'ok' },
    });
  } finally {
    await context.app.close();
  }
});
