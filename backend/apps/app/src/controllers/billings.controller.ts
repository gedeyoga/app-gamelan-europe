import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import {
  AuthenticatedUser,
  BillingService,
  CreateBillingDto,
  CurrentUser,
  ListBillingsQueryDto,
  ListMembersQueryDto,
  PaymentProofUploadInterceptor,
  Permissions,
  SubscribeBillingDto,
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

  // WAJIB di atas ':id' agar tidak tertelan ParseUUIDPipe.
  @Get('members')
  @Permissions('billing:read')
  async listMembers(@Query() query: ListMembersQueryDto) {
    const { items, total } = await this.billingService.listMembers(query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Post('subscribe')
  @Permissions('billing:create')
  @HttpCode(201)
  subscribe(@Body() dto: SubscribeBillingDto) {
    return this.billingService.subscribe(dto);
  }

  // Upload bukti bayar (gambar/PDF); statis di atas ':id'.
  @Post('payment-proof')
  @Permissions('billing:create')
  @HttpCode(201)
  @UseInterceptors(PaymentProofUploadInterceptor)
  uploadPaymentProof(@UploadedFile() file: Express.Multer.File) {
    return this.billingService.uploadPaymentProof(file);
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

  @Post(':id/cancel')
  @Permissions('billing:update')
  @HttpCode(200)
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.cancel(id);
  }

  @Delete(':id')
  @Permissions('billing:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.remove(id);
  }
}
