import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  AuthenticatedUser,
  BillingService,
  CreateBillingDto,
  CurrentUser,
  ListBillingsQueryDto,
  Permissions,
  UpdateBillingDto,
} from '@app/libs';

@Controller('billings')
export class BillingsController {
  constructor(private readonly billingService: BillingService) {}

  @Post()
  @Permissions('billing:create')
  @HttpCode(201)
  create(@Body() dto: CreateBillingDto) {
    return this.billingService.create(dto);
  }

  @Get()
  @Permissions('billing:read')
  async list(@Query() query: ListBillingsQueryDto) {
    const { items, total } = await this.billingService.list(query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  // LOGIN-only self-service; WAJIB di atas ':id' agar tidak tertelan ParseUUIDPipe.
  @Get('me')
  async findMine(@Query() query: ListBillingsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const { items, total } = await this.billingService.findMine(user.id, query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Get(':id')
  @Permissions('billing:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.findOne(id);
  }

  @Patch(':id')
  @Permissions('billing:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBillingDto) {
    return this.billingService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('billing:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.remove(id);
  }
}
