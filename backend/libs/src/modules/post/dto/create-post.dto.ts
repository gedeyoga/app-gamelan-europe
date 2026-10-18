import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateNested } from 'class-validator';
import { ContentStatus, ContentVisibility } from '@prisma/client';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Satu grup flyer bertipe. Tipe = teks bebas (bukan enum); duplikat tipe/id dicek di service → 422.
export class FlyerItemDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  type: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(50)
  imageIds: string[];
}

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

  // Checkbox FE "kirim notifikasi". false → tidak enqueue; default true.
  @IsOptional()
  @IsBoolean()
  notify?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(100)
  authorIds?: string[];

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

  // Daftar grup flyer bertipe; urutan array = urutan grup. Diganti seluruhnya bila dikirim saat update.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => FlyerItemDto)
  flyerItems?: FlyerItemDto[];
}
