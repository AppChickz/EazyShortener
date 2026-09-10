import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OriginCheckedRequest {
  method: string;
  headers: Record<string, string | string[] | undefined>;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<OriginCheckedRequest>();
    if (!MUTATING_METHODS.has(request.method.toUpperCase())) return true;

    const cookieName = this.config.getOrThrow<string>('JWT_COOKIE_NAME');
    const cookieHeader = this.header(request.headers.cookie);
    if (!this.hasCookie(cookieHeader, cookieName)) return true;

    const expectedOrigin = new URL(this.config.getOrThrow<string>('APP_BASE_URL')).origin;
    const suppliedOrigin = this.header(request.headers.origin) ?? this.originFromReferer(this.header(request.headers.referer));

    if (suppliedOrigin !== expectedOrigin) {
      throw new ForbiddenException('Cross-origin cookie-authenticated mutation rejected');
    }

    return true;
  }

  private hasCookie(cookieHeader: string | undefined, cookieName: string): boolean {
    if (!cookieHeader) return false;
    return cookieHeader.split(';').some((part) => part.trim().startsWith(`${cookieName}=`));
  }

  private originFromReferer(referer: string | undefined): string | undefined {
    if (!referer) return undefined;
    try {
      return new URL(referer).origin;
    } catch {
      return undefined;
    }
  }

  private header(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
