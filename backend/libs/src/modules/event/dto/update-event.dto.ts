import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateEventDto } from './create-event.dto';

export class UpdateEventDto extends PartialType(OmitType(CreateEventDto, ['thumbnail'] as const)) {
  // `undefined` = jangan sentuh; `null` = hapus thumbnail.
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnail?: string | null;
}
