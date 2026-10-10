import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Permintaan oleh member login: `fullName`/`email` diambil dari user, bukan body.
export class CreateMySubscriptionRequestDto {
  @IsUUID()
  subscriptionId: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;

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
}
