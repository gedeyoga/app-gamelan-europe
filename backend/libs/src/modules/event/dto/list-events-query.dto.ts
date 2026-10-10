import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';

export class ListEventsQueryDto extends ListQueryDto {
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

  // Relasi: hanya event yang punya link tipe ini (`eventTypes.some`).
  @IsOptional()
  @IsUUID()
  eventTypeId?: string;
}
