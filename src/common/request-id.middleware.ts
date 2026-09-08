import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SafeLogger } from './safe-logger';

interface RequestLike {
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  requestId?: string;
}

interface ResponseLike {
  setHeader(name: string, value: string): void;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(private readonly logger: SafeLogger) {}

  use(request: RequestLike, response: ResponseLike, next: () => void): void {
    const incoming = request.headers['x-request-id'];
    const requestId = typeof incoming === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(incoming) ? incoming : randomUUID();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    this.logger.request({
      requestId,
      method: request.method,
      url: request.originalUrl ?? request.url,
      ip: request.ip,
      headers: request.headers,
    });

    next();
  }
}
