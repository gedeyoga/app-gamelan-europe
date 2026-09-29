import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  AuthenticatedUser,
  CreateUserDto,
  CurrentUser,
  DeleteUserQueryDto,
  ListQueryDto,
  Permissions,
  UpdateUserDto,
  UpdateUserRoleDto,
  UserContentPurgeService,
  UserService,
} from '@app/libs';

@Controller('users')
export class UsersController {
  constructor(
    private readonly userService: UserService,
    private readonly userContentPurgeService: UserContentPurgeService,
  ) {}

  @Post()
  @Permissions('user:create')
  @HttpCode(201)
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.userService.create(dto, user.id);
  }

  @Get()
  @Permissions('user:read')
  async list(@Query() query: ListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const { items, total } = await this.userService.list(query, user.id);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Get(':id')
  @Permissions('user:read')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.userService.findOne(id, user.id);
  }

  @Patch(':id')
  @Permissions('user:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.userService.update(id, dto, user.id);
  }

  @Patch(':id/role')
  @Permissions('user:update')
  assignRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserRoleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.userService.assignRole(id, dto.roleId, user.id);
  }

  @Delete(':id')
  @Permissions('user:delete')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DeleteUserQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userContentPurgeService.remove(id, user.id, query.cascadeContent);
  }
}
