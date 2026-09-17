import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export type SortOrder = 'asc' | 'desc';

export class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 20;

  @IsOptional()
  @IsString()
  sortBy = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder: SortOrder = 'desc';

  // Global search bar untuk semua menu CRUD list.
  // Trim di service; kosong / <2 char → diabaikan (bukan error).
  // MaxLength 100 tetap divalidasi (422 bila lebih).
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsObject()
  @Type(() => Object)
  filter?: Record<string, unknown>;
}