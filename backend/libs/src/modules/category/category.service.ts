import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { CategoryRepository } from './category.repository';
import { CategoryEntity } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

export const CATEGORY_SEARCHABLE_FIELDS = ['name'];
export const CATEGORY_SORT_FIELDS = ['name', 'type', 'createdAt', 'updatedAt'];
export const CATEGORY_FILTER_FIELDS = ['type', 'name', 'createdAt', 'updatedAt'];
export const CATEGORY_DATE_FIELDS = ['createdAt', 'updatedAt'];

@Injectable()
export class CategoryService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async list(query: ListQueryDto): Promise<{ items: CategoryEntity[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, CATEGORY_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.CategoryWhereInput>(query.filter, CATEGORY_FILTER_FIELDS, {
      enumFields: { type: ['STORY', 'ARCHIVE'] },
      dateFields: CATEGORY_DATE_FIELDS,
    });
    const searchWhere = buildSearch<Prisma.CategoryWhereInput>(query.search, CATEGORY_SEARCHABLE_FIELDS);
    const where = combineWhere<Prisma.CategoryWhereInput>(
      filterWhere as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    return this.categoryRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.CategoryOrderByWithRelationInput>(query.sortBy, query.sortOrder),
    });
  }

  findOne(id: string): Promise<CategoryEntity> {
    return this.categoryRepository.findById(id);
  }

  create(dto: CreateCategoryDto): Promise<CategoryEntity> {
    return this.categoryRepository.createIdempotent({ name: dto.name, type: dto.type });
  }

  update(id: string, dto: UpdateCategoryDto): Promise<CategoryEntity> {
    const data: Prisma.CategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type;
    if (Object.keys(data).length === 0) {
      return this.findOne(id);
    }
    return this.categoryRepository.update(id, data);
  }

  remove(id: string): Promise<CategoryEntity> {
    return this.categoryRepository.remove(id);
  }
}
