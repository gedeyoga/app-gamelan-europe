import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ContentStatus, ContentVisibility } from '@prisma/client';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class EventDateDto {
  @IsISO8601()
  date: string;

  @IsOptional()
  @Matches(TIME_REGEX, { message: 'startTime must be "HH:mm" (24-hour)' })
  startTime?: string;

  @IsOptional()
  @Matches(TIME_REGEX, { message: 'endTime must be "HH:mm" (24-hour)' })
  endTime?: string;
}

export class EventLocationDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  lng?: number;
}

export class CreateEventDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(SLUG_REGEX, { message: 'slug must be lowercase alphanumeric with hyphens' })
  slug?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnail?: string;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsEnum(ContentVisibility)
  visibility?: ContentVisibility;

  // Tanggal publish manual (tombol "Terbitkan" di FE). Bila dikirim → status dipaksa PUBLISHED.
  @IsOptional()
  @IsISO8601()
  publishedAt?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(50)
  eventTypeIds?: string[];

  // Array kosong valid → clear/replace-all relasi event_dates.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventDateDto)
  @ArrayMaxSize(100)
  dates?: EventDateDto[];

  // Event wajib punya tepat satu lokasi.
  @IsObject()
  @ValidateNested()
  @Type(() => EventLocationDto)
  location: EventLocationDto;
}
