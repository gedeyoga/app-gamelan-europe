import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ArchiveStatus, ArchiveType } from '@prisma/client';

export class CreateArchiveDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  // Teks biasa, bukan rich HTML.
  @IsOptional()
  @IsString()
  description?: string;

  // URL absolut hasil `POST /images` (endpoint image TIDAK berubah). Tidak ada `imageIds`.
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnail?: string;

  @IsOptional()
  @IsEnum(ArchiveType)
  type?: ArchiveType; // default PUBLIC

  @IsOptional()
  @IsEnum(ArchiveStatus)
  status?: ArchiveStatus; // default DRAFT

  // Bila dikirim → paksa status = PUBLISHED.
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
  authorIds?: string[];

  // Urutan link = urutan array. Diganti seluruhnya bila dikirim saat update.
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  @ArrayMaxSize(50)
  externalLinks?: string[];

  // Urutan dokumen = urutan array (id baris `Document` hasil `POST /documents`).
  // Bind/unbind baris `Document` (entityId/entityType='archive') saat create/update.
  // Update = replace seluruh array.
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(50)
  documentIds?: string[];
}
