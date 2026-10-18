import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
  ListNotificationsQueryDto,
  NotificationService,
} from '@app/libs';

// LOGIN-only, self-scoped (tanpa permission baru).
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async list(@Query() query: ListNotificationsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const { items, total } = await this.notificationService.list(query, user.id);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Post('read-all')
  @HttpCode(200)
  readAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationService.markAllRead(user.id);
  }

  @Post(':id/read')
  @HttpCode(200)
  read(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationService.markRead(user.id, id);
  }
}
