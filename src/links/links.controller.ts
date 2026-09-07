import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtGuard } from '../auth/jwt.guard';
import { RateLimitGuard, UseRateLimit } from '../rate-limit/rate-limit.guard';
import { CreateLinkDto } from './dto/create-link.dto';
import { ListLinksDto, normalizeLinkPagination } from './dto/list-links.dto';
import { UpdateLinkDto } from './dto/update-link.dto';
import { LinksService } from './links.service';

interface AuthenticatedLinksRequest {
  user: User;
}

interface GuestCreateLinkBody {
  originalUrl?: unknown;
  expiresAt?: unknown;
  customAlias?: unknown;
  urls?: unknown;
}

@Controller('api/links')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Get()
  @UseGuards(JwtGuard)
  async listOwned(@Req() request: AuthenticatedLinksRequest, @Query() query: ListLinksDto) {
    const pagination = normalizeLinkPagination(query);
    const result = await this.linksService.listOwned(request.user.id, pagination);

    return {
      links: result.links,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
      },
    };
  }

  @Patch(':id')
  @UseGuards(JwtGuard)
  async updateOwned(
    @Param('id') id: string,
    @Req() request: AuthenticatedLinksRequest,
    @Body() body: Record<string, unknown>,
  ) {
    if (body.shortCode !== undefined || body.customAlias !== undefined) {
      throw new BadRequestException('Short code is immutable in v1');
    }

    if (body.originalUrl !== undefined && typeof body.originalUrl !== 'string') {
      throw new BadRequestException('originalUrl must be a string');
    }
    if (
      body.expiresAt !== undefined &&
      body.expiresAt !== null &&
      typeof body.expiresAt !== 'string'
    ) {
      throw new BadRequestException('expiresAt must be a date/time string or null');
    }
    if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
      throw new BadRequestException('isActive must be a boolean');
    }

    const input: UpdateLinkDto = {
      originalUrl: body.originalUrl,
      expiresAt: body.expiresAt,
      isActive: body.isActive,
    };

    try {
      return await this.linksService.updateOwned(request.user.id, id, input);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Unable to update link');
    }
  }

  @Post('guest')
  @UseGuards(RateLimitGuard)
  @UseRateLimit('guest')
  async createGuest(@Body() body: GuestCreateLinkBody) {
    if (body.customAlias !== undefined) {
      throw new BadRequestException('Guest links cannot use custom aliases');
    }

    if (body.urls !== undefined || typeof body.originalUrl !== 'string') {
      throw new BadRequestException('Guest creation accepts exactly one URL');
    }

    if (
      body.expiresAt !== undefined &&
      body.expiresAt !== null &&
      typeof body.expiresAt !== 'string'
    ) {
      throw new BadRequestException('Expiration must be a date/time string or null');
    }

    const input: CreateLinkDto = {
      originalUrl: body.originalUrl,
      expiresAt: body.expiresAt,
    };

    return this.linksService.createGuest(input);
  }
}
