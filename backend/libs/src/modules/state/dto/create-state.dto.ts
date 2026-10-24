import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateStateDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @Type(() => Number)
  @IsInt()
  countryId: number;
}
