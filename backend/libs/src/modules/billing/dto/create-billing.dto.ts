import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { BillingStatus, SubscriptionType } from '@prisma/client';
import { BillingLineDto } from './billing-line.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateBillingDto {
  @IsUUID()
  userId: string;

  // `null` eksplisit = lepas relasi (update) / diabaikan (create). Selaras @IsOptional (skip null).
  @IsOptional()
  @IsUUID()
  networkId?: string | null;

  @IsUUID()
  subscriptionId: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code: string;

  @IsOptional()
  @IsEnum(BillingStatus)
  status?: BillingStatus;

  @IsEnum(SubscriptionType)
  subscriptionType: SubscriptionType;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  currency: string;

  @IsNumber()
  @Min(0)
  total: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number | null;

  @IsOptional()
  @IsISO8601()
  paidAt?: string | null;

  @IsOptional()
  @IsISO8601()
  canceledAt?: string | null;

  // Boleh array kosong (0..N). Bila dikirim saat PATCH → REPLACE seluruh lines.
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillingLineDto)
  lines: BillingLineDto[];
}
