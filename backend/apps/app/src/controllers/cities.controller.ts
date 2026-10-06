import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CityService, CreateCityDto, ListQueryDto, Permissions, Public } from '@app/libs';

@Controller('cities')
export class CitiesController {
  constructor(private readonly cityService: CityService) {}

  // Idempoten: name sama (case-insensitive) + country + state → kembalikan existing.
  @Post()
  @Permissions('city:create')
  @HttpCode(201)
  create(@Body() dto: CreateCityDto) {
    return this.cityService.create(dto);
  }

  @Public()
  @Get()
  async list(@Query() query: ListQueryDto) {
    const { items, total } = await this.cityService.list(query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit, 100), total },
    };
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cityService.findById(id);
  }
}
