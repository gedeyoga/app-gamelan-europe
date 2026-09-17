import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CreateUserDto, ListQueryDto, Permissions, UpdateUserDto, UpdateUserRoleDto, UserService } from '@app/libs';

@Controller('users')
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Permissions('user:create')
  @HttpCode(201)
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Get()
  @Permissions('user:read')
  async list(@Query() query: ListQueryDto) {
    const { items, total } = await this.userService.list(query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Get(':id')
  @Permissions('user:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @Permissions('user:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @Patch(':id/role')
  @Permissions('user:update')
  assignRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserRoleDto) {
    return this.userService.assignRole(id, dto.roleId);
  }

  @Delete(':id')
  @Permissions('user:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.remove(id);
  }
}