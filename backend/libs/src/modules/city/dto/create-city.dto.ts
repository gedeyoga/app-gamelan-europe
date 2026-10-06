import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCityDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @Type(() => Number)
  @IsInt()
  countryId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  stateId?: number;
}
