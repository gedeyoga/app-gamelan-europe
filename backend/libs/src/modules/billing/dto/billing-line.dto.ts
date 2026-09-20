import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { BillingLineType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class BillingLineDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @IsEnum(BillingLineType)
  type: BillingLineType;

  @IsOptional()
  @IsInt()
  @Min(1)
  qty?: number;

  @IsNumber()
  @Min(0)
  amount: number;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  currency: string;
}
