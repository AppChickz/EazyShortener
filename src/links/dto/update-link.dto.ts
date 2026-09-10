import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateLinkDto {
  @IsOptional()
  @IsString()
  originalUrl?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
