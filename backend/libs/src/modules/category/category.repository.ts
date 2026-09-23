import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { categorySelect, CategoryEntity } from './entities/category.entity';

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<CategoryEntity> {
    const category = await this.prisma.category.findUnique({ where: { id }, select: categorySelect });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async findByIds(ids: string[]): Promise<CategoryEntity[]> {
    if (ids.length === 0) return [];
    return this.prisma.category.findMany({ where: { id: { in: ids } }, select: categorySelect });
  }

  async findMany(params: {
    where: Prisma.CategoryWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.CategoryOrderByWithRelationInput;
  }): Promise<{ items: CategoryEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({ ...params, select: categorySelect }),
      this.prisma.category.count({ where: params.where }),
    ]);
    return { items, total };
  }

  // Inline-add kategori: name sama (case-insensitive) + type sama → kembalikan existing (bukan 409).
  async createIdempotent(data: { name: string; type: Prisma.CategoryCreateInput['type'] }): Promise<CategoryEntity> {
    const existing = await this.prisma.category.findFirst({
      where: { name: { equals: data.name, mode: 'insensitive' }, type: data.type },
      select: categorySelect,
    });
    if (existing) return existing;
    return this.prisma.category.create({ data, select: categorySelect });
  }

  async update(id: string, data: Prisma.CategoryUpdateInput): Promise<CategoryEntity> {
    const existing = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Category not found');
    return this.prisma.category.update({ where: { id }, data, select: categorySelect });
  }

  async remove(id: string): Promise<CategoryEntity> {
    const existing = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Category not found');
    return this.prisma.category.delete({ where: { id }, select: categorySelect });
  }
}
