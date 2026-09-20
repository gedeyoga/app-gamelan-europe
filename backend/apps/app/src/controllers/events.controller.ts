import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  AuthenticatedUser,
  CreateEventDto,
  CurrentUser,
  EventService,
  ListEventsQueryDto,
  Permissions,
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

  @Get(':id')
  @Permissions('event:read')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.eventService.findOne(id, user.id);
  }

  @Patch(':id')
  @Permissions('event:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEventDto, @CurrentUser() user: AuthenticatedUser) {
    return this.eventService.update(id, dto, user.id);
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
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.eventService.transition(id, 'approve', user.id);
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
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.eventService.transition(id, 'publish', user.id);
  }

  @Post(':id/unpublish')
  @Permissions('event:unpublish')
  @HttpCode(200)
  unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.eventService.transition(id, 'unpublish', user.id);
  }
}
