import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApproveSubscriptionRequestDto,
  AuthenticatedUser,
  CreateMySubscriptionRequestDto,
  CreatePublicSubscriptionRequestDto,
  CurrentUser,
  ListSubscriptionRequestsQueryDto,
  Permissions,
  Public,
  ReviewSubscriptionRequestDto,
  SubscriptionRequestService,
} from '@app/libs';

@Controller('subscription-requests')
export class SubscriptionRequestsController {
  constructor(private readonly subscriptionRequestService: SubscriptionRequestService) {}

  // Publik (website EGS, tanpa akun).
  @Post()
  @Public()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  createPublic(@Body() dto: CreatePublicSubscriptionRequestDto) {
    return this.subscriptionRequestService.createPublic(dto);
  }

  // LOGIN-only self-service; WAJIB di atas ':id' agar tidak tertelan ParseUUIDPipe.
  @Post('me')
  @HttpCode(201)
  createMine(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMySubscriptionRequestDto) {
    return this.subscriptionRequestService.createMine(user.id, dto);
  }

  @Get('me')
  async listMine(@Query() query: ListSubscriptionRequestsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const { items, total } = await this.subscriptionRequestService.listMine(user.id, query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Get()
  @Permissions('subscription-request:read')
  async list(@Query() query: ListSubscriptionRequestsQueryDto) {
    const { items, total } = await this.subscriptionRequestService.list(query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  // WAJIB di atas ':id' agar tidak tertelan ParseUUIDPipe.
  @Post(':id/approve')
  @Permissions('subscription-request:approve')
  @HttpCode(200)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveSubscriptionRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subscriptionRequestService.approve(id, user.id, {
      note: dto?.note,
      paymentProofUrl: dto?.paymentProofUrl,
      paymentProofName: dto?.paymentProofName,
    });
  }

  @Post(':id/reject')
  @Permissions('subscription-request:reject')
  @HttpCode(200)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewSubscriptionRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subscriptionRequestService.reject(id, user.id, dto?.note);
  }

  @Get(':id')
  @Permissions('subscription-request:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionRequestService.findOne(id);
  }
}
