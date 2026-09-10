import { IsOptional, IsString } from 'class-validator';

export class ListLinksDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export interface LinkPagination {
  page: number;
  limit: number;
}

export function normalizeLinkPagination(input: ListLinksDto): LinkPagination {
  const requestedPage = Number.parseInt(input.page ?? '1', 10);
  const requestedLimit = Number.parseInt(input.limit ?? '20', 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const positiveLimit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 20;

  return {
    page,
    limit: Math.min(positiveLimit, 100),
  };
}
