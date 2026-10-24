import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  AuthenticatedUser,
  BulkDeleteEventsDto,
  BulkUpdateEventStatusDto,
  CreateEventDto,
  CurrentUser,
  EventService,
  ListEventsQueryDto,
  Permissions,
  PublishContentDto,
  SlugParamDto,
  UpdateEventDto,
} from '@app/libs';

@Controller('events')
export class EventsController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  @Permissions('event:create')
  @HttpCode(201)
  create(@Body() dto: CreateEventDto, @CurrentUser() user: AuthenticatedUser) {
    return this.eventService.create(dto, user.id);
  }

  @Get()
  @Permissions('event:read')
  async list(@Query() query: ListEventsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const { items, total } = await this.eventService.list(query, user.id);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Get('slug/:slug')
  @Permissions('event:read')
  findOneBySlug(@Param() params: SlugParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.eventService.findOneBySlug(params.slug, user.id);
  }

  // Bulk route dideklarasikan sebelum `@Post(':id/...')` agar tidak tertangkap route berparameter.
  @Post('bulk-status')
  @Permissions('event:update')
  @HttpCode(200)
  bulkUpdateStatus(@Body() dto: BulkUpdateEventStatusDto, @CurrentUser() user: AuthenticatedUser) {
    return this.eventService.bulkUpdateStatus(dto.ids, dto.status, user.permissions ?? [], user.id);
  }

  @Post('bulk-delete')
  @Permissions('event:delete')
  @HttpCode(200)
  bulkDelete(@Body() dto: BulkDeleteEventsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.eventService.bulkDelete(dto.ids, user.id);
  }

  @Get(':id')
  @Permissions('event:read')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.eventService.findOne(id, user.id);
  }

  @Patch(':id')
  @Permissions('event:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEventDto, @CurrentUser() user: AuthenticatedUser) {
    return this.eventService.update(id, dto, user.id, user.permissions ?? []);
  }

  @Delete(':id')
  @Permissions('event:delete')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.eventService.remove(id, user.id);
  }

  @Post(':id/submit')
  @Permissions('event:submit')
  @HttpCode(200)
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.eventService.transition(id, 'submit', user.id);
  }

  @Post(':id/approve')
  @Permissions('event:approve')
  @HttpCode(200)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishContentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.eventService.transition(id, 'approve', user.id, { publishedAt: dto?.publishedAt, notify: dto?.notify });
  }

  @Post(':id/reject')
  @Permissions('event:reject')
  @HttpCode(200)
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.eventService.transition(id, 'reject', user.id);
  }

  @Post(':id/publish')
  @Permissions('event:publish')
  @HttpCode(200)
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishContentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.eventService.transition(id, 'publish', user.id, { publishedAt: dto?.publishedAt, notify: dto?.notify });
  }

  @Post(':id/unpublish')
  @Permissions('event:unpublish')
  @HttpCode(200)
  unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.eventService.transition(id, 'unpublish', user.id);
  }
}
