import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  CategoryService,
  CreateCategoryDto,
  ListCategoriesQueryDto,
  Permissions,
  UpdateCategoryDto,
} from '@app/libs';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoryService: CategoryService) {}

  // Idempoten: name sama (case-insensitive) + type sama → kembalikan existing.
  @Post()
  @Permissions('category:create')
  @HttpCode(201)
  create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  @Get()
  @Permissions('category:read')
  async list(@Query() query: ListCategoriesQueryDto) {
    const { items, total } = await this.categoryService.list(query);
    return {
      data: items,
      meta: { page: query.page, limit: Math.min(query.limit ?? 20, 100), total },
    };
  }

  @Get(':id')
  @Permissions('category:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoryService.findOne(id);
  }

  @Patch(':id')
  @Permissions('category:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoryService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('category:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoryService.remove(id);
  }
}
