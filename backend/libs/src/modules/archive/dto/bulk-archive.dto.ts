import { ArchiveStatus } from '@prisma/client';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEnum, IsUUID } from 'class-validator';

export class BulkUpdateArchiveStatusDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids: string[];

  @IsEnum(ArchiveStatus)
  status: ArchiveStatus;
}

export class BulkDeleteArchivesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids: string[];
}
