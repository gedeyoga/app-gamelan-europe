import { IsOptional, IsUUID } from 'class-validator';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';

export class ListPostsQueryDto extends ListQueryDto {
  // Relasi: hanya post yang punya link kategori ini (`categories.some`).
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
