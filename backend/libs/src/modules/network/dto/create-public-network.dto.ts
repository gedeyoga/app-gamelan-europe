import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { NetworkOrganisationType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
// Blank/whitespace → undefined agar `@IsOptional` melewati validasi (semantik: absent).
const trimOrUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class PublicNetworkSocialMediaDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  platform: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  @MaxLength(500)
  url: string;
}

// Section `submitter` ("data pengirim") — disimpan pada kolom `submitter_email` di row `networks`
// (tanpa membuat `User`), dipakai review admin. Hanya `email` (wajib).
export class PublicNetworkSubmitterDto {
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(200)
  email: string;
}

// Submit publik (tanpa JWT): menulis langsung ke `networks` (`status=REQUEST`, `source=PUBLIC`).
export class CreatePublicNetworkDto {
  @IsEnum(NetworkOrganisationType)
  organisationType: NetworkOrganisationType;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  ledBy?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  activityType?: string;

  @Type(() => Number)
  @IsInt()
  countryId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  stateId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cityId?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @IsUrl()
  @MaxLength(2048)
  mapsUrl?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @IsUrl()
  @MaxLength(500)
  website?: string;

  @Transform(trimOrUndefined)
  @IsOptional()
  @IsString()
  @Matches(/^(?:[^\s@]+@[^\s@]+\.[^\s@]{2,}|\+?\d{7,15})$/, {
    message: 'contact must be an email or phone number',
  })
  @MaxLength(200)
  contact?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PublicNetworkSocialMediaDto)
  socialMedia?: PublicNetworkSocialMediaDto[];

  // Rich HTML; disanitasi server-side (`sanitizeStoryContent`) di service.
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;

  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => PublicNetworkSubmitterDto)
  submitter: PublicNetworkSubmitterDto;
}
