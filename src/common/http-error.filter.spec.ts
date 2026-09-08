import { BadRequestException } from '@nestjs/common';
import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpErrorFilter } from './http-error.filter';

function run(exception: unknown) {
  let statusCode = 0;
  let body: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      body = value;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: '/api/test', requestId: 'req-123' }),
    }),
  };

  new HttpErrorFilter().catch(exception, host as never);
  return { statusCode, body: body as Record<string, unknown> };
}

void test('standardizes HttpException responses', () => {
  const result = run(new BadRequestException(['invalid input']));
  assert.equal(result.statusCode, 400);
  assert.equal(result.body.statusCode, 400);
  assert.deepEqual(result.body.message, ['invalid input']);
  assert.equal(result.body.path, '/api/test');
  assert.equal(result.body.requestId, 'req-123');
});

void test('does not expose unknown internal errors', () => {
  const result = run(new Error('database secret leaked'));
  assert.equal(result.statusCode, 500);
  assert.equal(result.body.message, 'Internal server error');
});
