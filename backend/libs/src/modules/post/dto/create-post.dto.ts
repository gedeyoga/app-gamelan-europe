import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ContentStatus, ContentVisibility } from '@prisma/client';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreatePostDto {
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
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(100)
  imageIds?: string[];

  // Urutan galeri = urutan array ini. Diganti seluruhnya bila dikirim saat update.
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(100)
  galleryImageIds?: string[];

  // Urutan flyer = urutan array ini. Diganti seluruhnya bila dikirim saat update.
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(100)
  flyerImageIds?: string[];
}
