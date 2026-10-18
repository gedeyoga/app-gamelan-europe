import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Path param `:slug` untuk lookup tautan email. Validasi → 422 via ValidationPipe global.
export class SlugParamDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Matches(SLUG_REGEX, { message: 'slug must be lowercase alphanumeric with hyphens' })
  slug: string;
}
