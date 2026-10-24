import { ContentStatus } from '@prisma/client';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEnum, IsUUID } from 'class-validator';

export class BulkUpdatePostStatusDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids: string[];

  @IsEnum(ContentStatus)
  status: ContentStatus;
}

export class BulkDeletePostsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids: string[];
}
