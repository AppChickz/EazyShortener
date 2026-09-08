import { Controller, Get, Param, Redirect, Req } from '@nestjs/common';
import { RedirectService } from './redirect.service';

@Controller()
export class RedirectController {
  constructor(private readonly redirects: RedirectService) {}

  @Get(':shortCode')
  @Redirect(undefined, 302)
  async redirect(
    @Param('shortCode') shortCode: string,
    @Req() request: { ip?: string; headers: Record<string, string | string[] | undefined> },
  ): Promise<{ url: string }> {
    const referrer = request.headers.referer;
    const userAgent = request.headers['user-agent'];
    const url = await this.redirects.resolve(shortCode, {
      ip: request.ip,
      referrer: typeof referrer === 'string' ? referrer : null,
      userAgent: typeof userAgent === 'string' ? userAgent : null,
    });
    return { url };
  }
}
