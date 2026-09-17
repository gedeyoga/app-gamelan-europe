import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import {
  CreateRoleDto,
  ListQueryDto,
  Permissions,
  ReplaceRolePermissionsDto,
  RoleService,
  UpdateRoleDto,
} from '@app/libs';

@Controller('roles')
export class RolesController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @Permissions('role:create')
  @HttpCode(201)
  create(@Body() dto: CreateRoleDto) {
    return this.roleService.create(dto);
  }

  @Get()
  @Permissions('role:read')
  async list(@Query() query: ListQueryDto) {
    const { items, total } = await this.roleService.list(query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Get(':id')
  @Permissions('role:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roleService.findOneWithPermissions(id);
  }

  @Patch(':id')
  @Permissions('role:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.roleService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('role:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.roleService.remove(id);
  }

  @Get(':id/permissions')
  @Permissions('permission:read')
  getPermissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.roleService.getPermissions(id);
  }

  @Put(':id/permissions')
  @Permissions('permission:update')
  setPermissions(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplaceRolePermissionsDto) {
    return this.roleService.setPermissions(id, dto.permissionIds);
  }
}