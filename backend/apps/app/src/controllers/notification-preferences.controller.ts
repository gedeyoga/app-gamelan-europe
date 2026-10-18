import { Body, Controller, Get, Param, ParseEnumPipe, Patch } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import {
  AuthenticatedUser,
  CurrentUser,
  NotificationService,
  UpdateNotificationPreferenceDto,
} from '@app/libs';

// LOGIN-only, self-scoped; `channel` selalu EMAIL (tidak diekspos di body).
@Controller('notification-preferences')
export class NotificationPreferencesController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationService.getPreferences(user.id);
  }

  // `:type` invalid → 422 (bukan 400/404).
  @Patch(':type')
  update(
    @Param('type', new ParseEnumPipe(NotificationType, { errorHttpStatusCode: 422 }))
    type: NotificationType,
    @Body() dto: UpdateNotificationPreferenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationService.updatePreference(user.id, type, dto.emailEnabled);
  }
}
