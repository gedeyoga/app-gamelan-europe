import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  AuthenticatedUser,
  CreateSubscriptionDto,
  CurrentUser,
  ListSubscriptionsQueryDto,
  Permissions,
  SubscriptionService,
  UpdateSubscriptionDto,
} from '@app/libs';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post()
  @Permissions('subscription:create')
  @HttpCode(201)
  create(@Body() dto: CreateSubscriptionDto) {
    return this.subscriptionService.create(dto);
  }

  @Get()
  @Permissions('subscription:read')
  async list(@Query() query: ListSubscriptionsQueryDto) {
    const { items, total } = await this.subscriptionService.list(query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  // LOGIN-only self-service; WAJIB di atas ':id' agar tidak tertelan ParseUUIDPipe.
  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionService.findMine(user.id);
  }

  // Katalog paket (non-deleted, status ACTIVE) untuk semua user login.
  @Get('available')
  async available(@Query() query: ListSubscriptionsQueryDto) {
    const { items, total } = await this.subscriptionService.listAvailable(query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Get(':id')
  @Permissions('subscription:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionService.findOne(id);
  }

  @Patch(':id')
  @Permissions('subscription:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.subscriptionService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('subscription:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionService.remove(id);
  }
}
