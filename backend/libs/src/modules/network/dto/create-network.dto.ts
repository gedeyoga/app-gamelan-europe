import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { NetworkOrganisationType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
// Whitespace-only → null (bukan `''`) agar kolom nullable benar-benar kosong.
const trimNullable = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
const trimNullableLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() || null : value;

export class NetworkSocialMediaDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  platform: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  url: string;
}

export class CreateNetworkDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  // Rich HTML; disanitasi server-side (`sanitizeStoryContent`) di create & update.
  @IsOptional()
  @IsString()
  @MaxLength(100000)
  content?: string;

  // `null` eksplisit = kosongkan (update). `@Transform(trim)` melewatkan null apa adanya.
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string | null;

  // Link Google Maps (long URL / shortlink).
  @IsOptional()
  @Transform(trim)
  @IsUrl({}, { message: 'mapsUrl must be a URL' })
  @MaxLength(2048)
  mapsUrl?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contact?: string | null;

  // `null` eksplisit = kosongkan (update) → `Prisma.DbNull`. Max 10 entri.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => NetworkSocialMediaDto)
  socialMedia?: NetworkSocialMediaDto[] | null;

  // `null` eksplisit = kosongkan (update).
  @IsOptional()
  @IsEnum(NetworkOrganisationType)
  organisationType?: NetworkOrganisationType | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  ledBy?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  activityType?: string | null;

  // Identitas pengirim usulan publik (kolom `submitter_*`); `null` eksplisit = kosongkan (update).
  @Transform(trimNullable)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  submitterFullName?: string | null;

  @Transform(trimNullableLower)
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  submitterEmail?: string | null;

  @Transform(trimNullable)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  submitterCountry?: string | null;

  @Transform(trimNullable)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  submitterState?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}
