import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateArchiveDto } from './create-archive.dto';

export class UpdateArchiveDto extends PartialType(
  OmitType(CreateArchiveDto, ['thumbnail', 'publishedAt'] as const),
) {
  // `undefined` = jangan sentuh; `null` = hapus thumbnail.
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnail?: string | null;

  // `undefined`/`null` = jangan sentuh (null diabaikan service, bukan epoch);
  // ISO string = set tanggal + paksa PUBLISHED.
  @IsOptional()
  @IsISO8601()
  publishedAt?: string;
}
