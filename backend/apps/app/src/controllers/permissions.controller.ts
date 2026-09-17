import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  CreatePermissionDto,
  ListQueryDto,
  Permissions,
  PermissionService,
  UpdatePermissionDto,
} from '@app/libs';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post()
  @Permissions('permission:create')
  @HttpCode(201)
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionService.create(dto);
  }

  @Get()
  @Permissions('permission:read')
  async list(@Query() query: ListQueryDto) {
    const { items, total } = await this.permissionService.list(query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Get(':id')
  @Permissions('permission:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionService.findOne(id);
  }

  @Patch(':id')
  @Permissions('permission:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePermissionDto) {
    return this.permissionService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('permission:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionService.remove(id);
  }
}