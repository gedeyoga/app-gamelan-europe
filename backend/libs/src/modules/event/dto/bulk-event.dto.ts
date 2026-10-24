import { ContentStatus } from '@prisma/client';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEnum, IsUUID } from 'class-validator';

export class BulkUpdateEventStatusDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids: string[];

  @IsEnum(ContentStatus)
  status: ContentStatus;
}

export class BulkDeleteEventsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids: string[];
}
