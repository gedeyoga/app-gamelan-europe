import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { roleSelect, roleWithPermissionsSelect, RoleEntity, RoleWithPermissionsEntity } from './entities/role.entity';

@Injectable()
export class RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toCode(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');
  }

  private toConstraintError(field: string, message: string) {
    return new UnprocessableEntityException({ message: 'Validation failed', errors: [{ field, message }] });
  }

  async findById(id: string): Promise<RoleEntity> {
    const role = await this.prisma.role.findUnique({ where: { id }, select: roleSelect });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async findByCode(code: string): Promise<RoleEntity | null> {
    return this.prisma.role.findUnique({ where: { code }, select: roleSelect });
  }

  async findByIdWithPermissions(id: string): Promise<RoleWithPermissionsEntity> {
    const role = await this.prisma.role.findUnique({ where: { id }, select: roleWithPermissionsSelect });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async findMany(params: {
    where: Prisma.RoleWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.RoleOrderByWithRelationInput;
  }): Promise<{ items: RoleEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.role.findMany({ ...params, select: roleSelect }),
      this.prisma.role.count({ where: params.where }),
    ]);
    return { items, total };
  }

  async create(data: Omit<Prisma.RoleCreateInput, 'code'>): Promise<RoleEntity> {
    const code = this.toCode(data.name as string);
    try {
      return await this.prisma.role.create({ data: { ...data, code }, select: roleSelect });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const meta = (e as Prisma.PrismaClientKnownRequestError).meta as { target?: string[] };
        const field = meta?.target?.includes('code') ? 'code' : 'name';
        throw this.toConstraintError(field, field === 'code' ? 'Code already exists' : 'Role already exists');
      }
      throw e;
    }
  }

  async update(id: string, data: Omit<Prisma.RoleUpdateInput, 'code'>): Promise<RoleEntity> {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Role not found');
    const updateData: Prisma.RoleUpdateInput = { ...data };
    if (typeof data.name === 'string') {
      updateData.code = this.toCode(data.name);
    }
    try {
      return await this.prisma.role.update({ where: { id }, data: updateData, select: roleSelect });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const meta = (e as Prisma.PrismaClientKnownRequestError).meta as { target?: string[] };
        const field = meta?.target?.includes('code') ? 'code' : 'name';
        throw this.toConstraintError(field, field === 'code' ? 'Code already exists' : 'Role already exists');
      }
      throw e;
    }
  }

  async remove(id: string): Promise<RoleEntity> {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Role not found');

    const userCount = await this.prisma.user.count({ where: { roleId: id } });
    if (userCount > 0) throw this.toConstraintError('name', 'Role is still assigned to users');

    return this.prisma.role.delete({ where: { id }, select: roleSelect });
  }
}