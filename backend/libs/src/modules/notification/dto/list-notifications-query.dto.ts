import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { NotificationStatus } from '@prisma/client';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';

export const NOTIFICATION_SORT_FIELDS = ['createdAt', 'readAt'];
export const NOTIFICATION_FILTER_FIELDS = ['status', 'readAt', 'createdAt'];

export class ListNotificationsQueryDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  // `true` → hanya yang belum dibaca (`readAt = null`).
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  unread?: boolean;
}
