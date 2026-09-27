import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

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
}
