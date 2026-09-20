import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiKeyService,
  AuthenticatedUser,
  CreateApiKeyDto,
  CurrentUser,
  ListApiKeysQueryDto,
  Permissions,
  UpdateApiKeyDto,
} from '@app/libs';

@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @Permissions('apikey:create')
  @HttpCode(201)
  create(@Body() dto: CreateApiKeyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.apiKeyService.create(dto, user.id);
  }

  @Get()
  @Permissions('apikey:read')
  async list(@Query() query: ListApiKeysQueryDto) {
    const { items, total } = await this.apiKeyService.list(query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Get(':id')
  @Permissions('apikey:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.apiKeyService.findOne(id);
  }

  @Patch(':id')
  @Permissions('apikey:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApiKeyDto) {
    return this.apiKeyService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('apikey:delete')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.apiKeyService.remove(id);
    return null;
  }
}
