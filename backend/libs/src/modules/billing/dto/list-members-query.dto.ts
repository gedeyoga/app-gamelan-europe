import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ListQueryDto, SortOrder } from '@app/libs/common/dto/list-query.dto';

// Default berbeda dari ListQueryDto: list member default `fullName` asc.
export class ListMembersQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  override sortBy = 'fullName';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  override sortOrder: SortOrder = 'asc';
}
