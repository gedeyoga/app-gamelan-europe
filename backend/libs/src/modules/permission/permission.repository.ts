import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import {
  permissionSelect,
  permissionCodeSelect,
  PermissionEntity,
} from './entities/permission.entity';

@Injectable()
export class PermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<PermissionEntity> {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
      select: permissionSelect,
    });
    if (!permission) throw new NotFoundException('Permission not found');
    return permission;
  }

  async findByCode(code: string): Promise<PermissionEntity | null> {
    return this.prisma.permission.findUnique({ where: { code }, select: permissionSelect });
  }

  async findMany(params: {
    where: Prisma.PermissionWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.PermissionOrderByWithRelationInput;
  }): Promise<{ items: PermissionEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.permission.findMany({ ...params, select: permissionSelect }),
      this.prisma.permission.count({ where: params.where }),
    ]);
    return { items, total };
  }

  async create(data: Prisma.PermissionCreateInput): Promise<PermissionEntity> {
    try {
      return await this.prisma.permission.create({ data, select: permissionSelect });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Permission already exists');
      }
      throw e;
    }
  }

  async update(id: string, data: Prisma.PermissionUpdateInput): Promise<PermissionEntity> {
    const existing = await this.prisma.permission.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Permission not found');
    try {
      return await this.prisma.permission.update({ where: { id }, data, select: permissionSelect });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Permission already exists');
      }
      throw e;
    }
  }

  async remove(id: string): Promise<PermissionEntity> {
    const existing = await this.prisma.permission.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Permission not found');
    return this.prisma.permission.delete({ where: { id }, select: permissionSelect });
  }

  async findCodesByUserId(userId: string): Promise<string[]> {
    const rows = await this.prisma.rolePermission.findMany({
      where: { role: { users: { some: { id: userId } } } },
      select: { permission: { select: permissionCodeSelect } },
    });
    return rows.map((r) => r.permission.code);
  }
}