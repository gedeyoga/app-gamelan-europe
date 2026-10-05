import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// Cap durasi inklusif (dipakai saat enumerasi EventDate) — mencegah DoS tanggal.
export const MAX_EVENT_RANGE_DAYS = 31;
const MS_PER_DAY = 86_400_000;
const TIME_RE = /[T ](\d{2}:\d{2})/;
// "HH:mm" dari ISO lokal; string zero-padded → perbandingan lexikografis = kronologis.

function toTimeParts(iso: string): string {
  const m = TIME_RE.exec(iso);
  return m ? m[1] : '';
}

// Cross-field `endDate` vs `startDate`: endDate >= startDate DAN rentang inklusif <= 31 hari.
function IsEventDateRange(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isEventDateRange',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          return rangeError(args.object as { startDate?: string; endDate?: string }) === null;
        },
        defaultMessage(args: ValidationArguments) {
          return rangeError(args.object as { startDate?: string; endDate?: string }) ?? 'invalid date range';
        },
      },
    });
  };
}

function rangeError(obj: { startDate?: string; endDate?: string }): string | null {
  if (typeof obj.startDate !== 'string' || typeof obj.endDate !== 'string') return null;
  const start = Date.parse(obj.startDate);
  const end = Date.parse(obj.endDate);
  if (Number.isNaN(start) || Number.isNaN(end)) return null; // format ditangani @IsISO8601
  if (end < start) return 'endDate must not be before startDate';
  // Jam diterapkan identik ke tiap hari → endTime < startTime bikin tiap hari berakhir sebelum mulai.
  if (TIME_RE.test(obj.startDate) && TIME_RE.test(obj.endDate)) {
    const startTime = toTimeParts(obj.startDate);
    const endTime = toTimeParts(obj.endDate);
    if (endTime < startTime) return 'endDate time must not be before startDate time';
  }
  const inclusiveDays = Math.floor((end - start) / MS_PER_DAY) + 1;
  if (inclusiveDays > MAX_EVENT_RANGE_DAYS) {
    return `date range must not exceed ${MAX_EVENT_RANGE_DAYS} days`;
  }
  return null;
}

// Section `author` (data pengirim) — dipakai find-or-create User publik.
// Cross-field `author.stateId` milik `author.countryId` dicek di service → 422 `author.stateId`.
export class PublicEventAuthorDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName: string;

  @Transform(trimLower)
  @IsEmail()
  @MaxLength(200)
  email: string;

  @Type(() => Number)
  @IsInt()
  countryId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  stateId?: number;
}

// Bentuk body sama dengan `CreateEventSubmissionDto` lama (kontrak konsumen eksternal EGS).
export class CreatePublicEventDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsISO8601()
  startDate: string;

  @IsISO8601()
  @IsEventDateRange()
  endDate: string;

  @Type(() => Number)
  @IsInt()
  countryId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  stateId?: number;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  organiser: string;

  // Section terpisah "data pengirim" (wajib) — bukan bagian dari geo/organiser event.
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => PublicEventAuthorDto)
  author: PublicEventAuthorDto;

  @IsUUID('4')
  eventTypeId: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  shortDescription: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnail?: string;
}
