import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ListQueryDto, Public, StateService } from '@app/libs';

@Controller('states')
export class StatesController {
  constructor(private readonly stateService: StateService) {}

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
