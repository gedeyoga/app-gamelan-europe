import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  AuthenticatedUser,
  CreatePostDto,
  CurrentUser,
  ListPostsQueryDto,
  Permissions,
  PostService,
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
  async list(@Query() query: ListPostsQueryDto) {
    const { items, total } = await this.postService.list(query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Get(':id')
  @Permissions('story:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.postService.findOne(id);
  }

  @Patch(':id')
  @Permissions('story:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePostDto) {
    return this.postService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('story:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.postService.remove(id);
  }
}
