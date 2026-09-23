import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  AuthenticatedUser,
  CreatePostDto,
  CurrentUser,
  ListPostsQueryDto,
  Permissions,
  PostService,
  PublishContentDto,
  UpdatePostDto,
} from '@app/libs';

@Controller('posts')
export class PostsController {
  constructor(private readonly postService: PostService) {}

  @Post()
  @Permissions('story:create')
  @HttpCode(201)
  create(@Body() dto: CreatePostDto, @CurrentUser() user: AuthenticatedUser) {
    return this.postService.create(dto, user.id);
  }

  @Get()
  @Permissions('story:read')
  async list(@Query() query: ListPostsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const { items, total } = await this.postService.list(query, user.id);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Get(':id')
  @Permissions('story:read')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.postService.findOne(id, user.id);
  }

  @Patch(':id')
  @Permissions('story:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePostDto, @CurrentUser() user: AuthenticatedUser) {
    return this.postService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Permissions('story:delete')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.postService.remove(id, user.id);
  }

  @Post(':id/submit')
  @Permissions('story:submit')
  @HttpCode(200)
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.postService.transition(id, 'submit', user.id);
  }

  @Post(':id/approve')
  @Permissions('story:approve')
  @HttpCode(200)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishContentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.postService.transition(id, 'approve', user.id, { publishedAt: dto?.publishedAt });
  }

  @Post(':id/reject')
  @Permissions('story:reject')
  @HttpCode(200)
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.postService.transition(id, 'reject', user.id);
  }

  @Post(':id/publish')
  @Permissions('story:publish')
  @HttpCode(200)
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishContentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.postService.transition(id, 'publish', user.id, { publishedAt: dto?.publishedAt });
  }

  @Post(':id/unpublish')
  @Permissions('story:unpublish')
  @HttpCode(200)
  unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.postService.transition(id, 'unpublish', user.id);
  }
}
