import { IsEnum, IsOptional } from 'class-validator';
import { ContentStatus } from '@prisma/client';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';

export class ListPostsQueryDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(ContentStatus)
  filterStatus?: ContentStatus;
}
