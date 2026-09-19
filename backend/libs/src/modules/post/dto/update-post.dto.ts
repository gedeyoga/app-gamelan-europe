import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreatePostDto } from './create-post.dto';

export class UpdatePostDto extends PartialType(OmitType(CreatePostDto, ['thumbnail'] as const)) {
  // `undefined` = jangan sentuh; `null` = hapus thumbnail.
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnail?: string | null;
}
