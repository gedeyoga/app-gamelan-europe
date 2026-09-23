import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ArchiveService,
  AuthenticatedUser,
  CreateArchiveDto,
  CurrentUser,
  ListArchivesQueryDto,
  Permissions,
  PublishContentDto,
  UpdateArchiveDto,
} from '@app/libs';

@Controller('archives')
export class ArchivesController {
  constructor(private readonly archiveService: ArchiveService) {}

  @Post()
  @Permissions('archive:create')
  @HttpCode(201)
  create(@Body() dto: CreateArchiveDto, @CurrentUser() user: AuthenticatedUser) {
    return this.archiveService.create(dto, user.id);
  }

  @Get()
  @Permissions('archive:read')
  async list(@Query() query: ListArchivesQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const { items, total } = await this.archiveService.list(query, user.id);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Get(':id')
  @Permissions('archive:read')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.archiveService.findOne(id, user.id);
  }

  @Patch(':id')
  @Permissions('archive:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateArchiveDto, @CurrentUser() user: AuthenticatedUser) {
    return this.archiveService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Permissions('archive:delete')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.archiveService.remove(id, user.id);
  }

  @Post(':id/submit')
  @Permissions('archive:submit')
  @HttpCode(200)
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.archiveService.transition(id, 'submit', user.id);
  }

  @Post(':id/approve')
  @Permissions('archive:approve')
  @HttpCode(200)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishContentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.archiveService.transition(id, 'approve', user.id, { publishedAt: dto?.publishedAt });
  }

  @Post(':id/reject')
  @Permissions('archive:reject')
  @HttpCode(200)
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.archiveService.transition(id, 'reject', user.id);
  }

  @Post(':id/publish')
  @Permissions('archive:publish')
  @HttpCode(200)
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishContentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.archiveService.transition(id, 'publish', user.id, { publishedAt: dto?.publishedAt });
  }

  @Post(':id/unpublish')
  @Permissions('archive:unpublish')
  @HttpCode(200)
  unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.archiveService.transition(id, 'unpublish', user.id);
  }
}
