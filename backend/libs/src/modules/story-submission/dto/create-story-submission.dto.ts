import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
// Reuse bentuk grup flyer modul post (satu definisi; jangan bercabang).
import { FlyerItemDto } from '@app/libs/modules/post/dto/create-post.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// Section `submitter` (data pengirim) — section tersendiri, audit-only.
// Cross-field `submitter.stateId` milik `submitter.countryId` dicek di service → 422 `submitter.stateId`.
export class StorySubmissionSubmitterDto {
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

export class CreateStorySubmissionDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  // Rich HTML; disanitasi server-side (`sanitizeStoryContent`) di create & approve.
  @IsString()
  @IsNotEmpty()
  @MaxLength(100000)
  content: string;

  // Kategori `type='STORY'`; service memvalidasi tiap id ada & bertipe STORY (422 `categoryIds.N`).
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(20)
  categoryIds?: string[];

  // Id baris `Image` hasil `POST /story-submissions/images` (entityType='story-submission', entityId=null).
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(50)
  galleryImageIds?: string[];

  // Daftar grup flyer bertipe; urutan array = urutan grup. Duplikat tipe/id & ownership dicek di service → 422.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => FlyerItemDto)
  flyerItems?: FlyerItemDto[];

  // @deprecated Gunakan `flyerItems`. Dipertahankan agar form pengajuan lama tetap jalan:
  // bila dikirim tanpa `flyerItems` → dipetakan ke satu grup `[{ type: 'flyer', imageIds }]`.
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(50)
  flyerImageIds?: string[];

  // URL absolut hasil `POST /story-submissions/thumbnail`.
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnail?: string;

  // Section terpisah "data pengirim" (wajib) — audit-only, tidak disalin ke Post saat approve.
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => StorySubmissionSubmitterDto)
  submitter: StorySubmissionSubmitterDto;
}
