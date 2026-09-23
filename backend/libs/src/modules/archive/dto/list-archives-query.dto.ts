import { IsIn, IsOptional } from 'class-validator';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';

export class ListArchivesQueryDto extends ListQueryDto {
  // "My Archive": berorganisasi → arsip satu organisasi; tanpa organisasi → arsip buatan sendiri.
  // String query param; `'true'` mengaktifkan. Nilai lain ditolak 422.
  @IsOptional()
  @IsIn(['true', 'false'], { message: 'mine must be "true" or "false"' })
  mine?: 'true' | 'false';
}
