import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ArchiveMaterialType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// Section "Submitted By" — dipakai `findOrCreatePublicUser`. Cross-field `submitter.stateId`
// milik `submitter.countryId` dicek di service → 422 `submitter.stateId`.
export class PublicArchiveSubmitterDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200) fullName: string;
  @Transform(trimLower) @IsEmail() @MaxLength(200) email: string;
  @Type(() => Number) @IsInt() countryId: number;
  @IsOptional() @Type(() => Number) @IsInt() stateId?: number;
}

export class CreatePublicArchiveDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(2048) thumbnail?: string;
  @IsOptional() @IsArray() @IsUrl({}, { each: true }) @ArrayMaxSize(50) externalLinks?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) @ArrayMaxSize(20) attachments?: string[];
  @IsOptional() @IsEnum(ArchiveMaterialType) materialType?: ArchiveMaterialType;
  @IsOptional() @IsDateString() date?: string; // ISO `YYYY-MM-DD`
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) author?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) organisation?: string;
  @IsOptional() @Type(() => Number) @IsInt() countryId?: number;
  @IsOptional() @Type(() => Number) @IsInt() stateId?: number;
  @IsNotEmptyObject() @ValidateNested() @Type(() => PublicArchiveSubmitterDto) submitter: PublicArchiveSubmitterDto;
}
