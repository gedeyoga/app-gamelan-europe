import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  // RULES exception: password jangan di-trim (spasi leading/trailing signifikan).
  @MinLength(8)
  @MaxLength(128)
  @IsString()
  @IsNotEmpty()
  password: string;
}