import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  CreateEventTypeDto,
  EventTypeService,
  ListQueryDto,
  Permissions,
  Public,
} from '@app/libs';

@Controller('event-types')
export class EventTypesController {
  constructor(private readonly eventTypeService: EventTypeService) {}

  // Idempoten: name sama (case-insensitive) → kembalikan existing.
  @Post()
  @Permissions('event-type:create')
  @HttpCode(201)
  create(@Body() dto: CreateEventTypeDto) {
    return this.eventTypeService.create(dto);
  }

  @Get()
  @Public()
  async list(@Query() query: ListQueryDto) {
    const { items, total } = await this.eventTypeService.list(query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Delete(':id')
  @Permissions('event-type:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventTypeService.remove(id);
  }
}
