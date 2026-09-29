import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  CreateNetworkDto,
  ListNetworksQueryDto,
  NetworkService,
  Permissions,
  UpdateNetworkDto,
} from '@app/libs';

@Controller('networks')
export class NetworksController {
  constructor(private readonly networkService: NetworkService) {}

  @Post()
  @Permissions('network:create')
  @HttpCode(201)
  create(@Body() dto: CreateNetworkDto) {
    return this.networkService.create(dto);
  }

  @Get()
  @Permissions('network:read')
  async list(@Query() query: ListNetworksQueryDto) {
    const { items, total } = await this.networkService.list(query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Get(':id')
  @Permissions('network:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.networkService.findOne(id);
  }

  @Patch(':id')
  @Permissions('network:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNetworkDto) {
    return this.networkService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('network:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.networkService.remove(id);
  }
}
