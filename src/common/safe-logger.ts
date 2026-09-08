import { Injectable, Logger } from '@nestjs/common';

const REDACTED = '[REDACTED]';
const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key']);
const SENSITIVE_QUERY_KEYS = new Set(['token', 'access_token', 'api_key', 'apikey']);

@Injectable()
export class SafeLogger {
  private readonly logger = new Logger('HTTP');

  request(input: {
    requestId: string;
    method?: string;
    url?: string;
    ip?: string;
    headers?: Record<string, string | string[] | undefined>;
  }): void {
    this.logger.log({
      requestId: input.requestId,
      method: input.method ?? null,
      url: this.redactUrl(input.url),
      ip: input.ip ?? null,
      headers: this.redactHeaders(input.headers ?? {}),
    });
  }

  redactHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string | string[] | undefined> {
    return Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key, SENSITIVE_HEADERS.has(key.toLowerCase()) ? REDACTED : value]),
    );
  }

  redactUrl(value?: string): string | null {
    if (!value) return null;
    try {
      const url = new URL(value, 'http://local.invalid');
      for (const key of [...url.searchParams.keys()]) {
        if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) url.searchParams.set(key, REDACTED);
      }
      return `${url.pathname}${url.search}`;
    } catch {
      return value.split('?')[0] ?? null;
    }
  }
}
