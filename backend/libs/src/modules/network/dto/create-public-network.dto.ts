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
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { NetworkOrganisationType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

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

// Section `submitter` ("data pengirim") — audit-only, tidak pernah disalin ke Network.
// Cross-field `submitter.stateId` milik `submitter.countryId` dicek di service → 422.
export class PublicNetworkSubmitterDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName: string;

  @Transform(trimLower)
  @IsEmail()
  @MaxLength(200)
  email: string;

  @Type(() => Number)
  @IsInt()
  countryId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  stateId?: number;
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

  @Transform(trim)
  @IsEmail()
  @MaxLength(200)
  contact: string;

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
