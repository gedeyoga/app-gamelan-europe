import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';
import { SubscriptionRequestType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// Form publik (website EGS, tanpa akun) — mirror `CreatePublicEventDto`.
// Field asing (status/billingId/...) ditolak `forbidNonWhitelisted` → 422.
export class CreatePublicSubscriptionRequestDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName: string;

  @Transform(trimLower)
  @IsEmail()
  @MaxLength(200)
  email: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsUrl()
  @MaxLength(2048)
  website?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  organisation?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;

  @IsUUID()
  subscriptionId: string;

  @IsOptional()
  @IsEnum(SubscriptionRequestType)
  requestType?: SubscriptionRequestType;
}
