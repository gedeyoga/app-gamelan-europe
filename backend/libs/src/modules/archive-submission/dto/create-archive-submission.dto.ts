import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateArchiveSubmissionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  // Teks biasa, bukan rich HTML.
  @IsOptional()
  @IsString()
  description?: string;

  // URL absolut hasil `POST /archive-submissions/thumbnail`.
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnail?: string;

  // Urutan link = urutan array.
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  @ArrayMaxSize(50)
  externalLinks?: string[];

  // Urutan dokumen = urutan array (id baris `Document` hasil `POST /archive-submissions/attachments`).
  // Service memvalidasi tiap id ada, `entityType='archive-submission'`, `entityId=null`.
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(20)
  attachments?: string[];
}
