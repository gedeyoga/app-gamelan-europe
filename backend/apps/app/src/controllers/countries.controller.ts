import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CountryService, ListQueryDto, Public } from '@app/libs';

@Controller('countries')
export class CountriesController {
  constructor(private readonly countryService: CountryService) {}

  @Public()
  @Get()
  async list(@Query() query: ListQueryDto) {
    const { items, total } = await this.countryService.list(query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit, 100), total },
    };
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.countryService.findById(id);
  }
}
