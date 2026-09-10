import { IsOptional, IsString } from 'class-validator';

export class CreateLinkDto {
  @IsString()
  originalUrl!: string;

  @IsOptional()
  @IsString()
  expiresAt?: string | null;
}
