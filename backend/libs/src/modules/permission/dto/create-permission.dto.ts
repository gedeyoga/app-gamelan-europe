import { Transform } from 'class-transformer';
import { Matches, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePermissionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z]+:[a-z]+$/, {
    message: 'code must match lowercase resource:action format',
  })
  code: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}