import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CreateStateDto, ListQueryDto, Permissions, Public, StateService } from '@app/libs';

@Controller('states')
export class StatesController {
  constructor(private readonly stateService: StateService) {}

  // Idempoten: name sama (case-insensitive) + countryId → kembalikan existing.
  @Post()
  @Permissions('state:create')
  create(@Body() dto: CreateStateDto) {
    return this.stateService.create(dto);
  }

  @Public()
  @Get()
  async list(@Query() query: ListQueryDto) {
    const { items, total } = await this.stateService.list(query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit, 100), total },
    };
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.stateService.findById(id);
  }
}
