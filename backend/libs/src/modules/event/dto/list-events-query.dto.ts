import { IsEnum, IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { ContentStatus } from '@prisma/client';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';

export class ListEventsQueryDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(ContentStatus)
  filterStatus?: ContentStatus;

  // Bulan kalender UTC "YYYY-MM". Bila ada, hanya event dengan >=1 EventDate.date di bulan tsb.
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'eventMonth must be in YYYY-MM format' })
  eventMonth?: string;

  // "My Event": berorganisasi → event satu organisasi; tanpa organisasi → event buatan sendiri.
  // String query param; `'true'` mengaktifkan. Nilai lain ditolak 422.
  @IsOptional()
  @IsString()
  @IsIn(['true', 'false'], { message: 'mine must be "true" or "false"' })
  mine?: string;

  // "Upcoming": hanya event dengan >=1 EventDate.date di masa depan (UTC).
  // String query param; `'true'` mengaktifkan. Nilai lain ditolak 422.
  @IsOptional()
  @IsString()
  @IsIn(['true', 'false'], { message: 'upcoming must be "true" or "false"' })
  upcoming?: string;
}
