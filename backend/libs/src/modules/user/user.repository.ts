import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { userSelect, userWithPasswordSelect, UserEntity, UserAuthEntity } from './entities/user.entity';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserEntity> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmailWithPassword(email: string): Promise<UserAuthEntity | null> {
    return this.prisma.user.findUnique({ where: { email }, select: userWithPasswordSelect });
  }

  async findByIdWithPassword(id: string): Promise<UserAuthEntity | null> {
    return this.prisma.user.findUnique({ where: { id }, select: userWithPasswordSelect });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.prisma.user.findUnique({ where: { email }, select: userSelect });
  }

  async findMany(params: {
    where: Prisma.UserWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.UserOrderByWithRelationInput;
  }): Promise<{ items: UserEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ ...params, select: userSelect }),
      this.prisma.user.count({ where: params.where }),
    ]);
    return { items, total };
  }

  async create(data: Prisma.UserCreateInput): Promise<UserEntity> {
    try {
      return await this.prisma.user.create({ data, select: userSelect });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw this.toUniqueConstraintError(e);
      }
      throw e;
    }
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    try {
      return await this.prisma.user.update({ where: { id }, data, select: userSelect });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw this.toUniqueConstraintError(e);
      }
      throw e;
    }
  }

  private toUniqueConstraintError(e: Prisma.PrismaClientKnownRequestError): UnprocessableEntityException {
    const target = (e.meta?.target as string[] | undefined) ?? ['email'];
    const field = target[0] ?? 'email';
    return new UnprocessableEntityException({
      message: 'Validation failed',
      errors: [{ field, message: `${field} already exists` }],
    });
  }

  async updateRole(id: string, roleId: string): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');

    const role = await this.prisma.role.findUnique({ where: { id: roleId }, select: { id: true } });
    if (!role) throw new NotFoundException('Role not found');

    return this.prisma.user.update({ where: { id }, data: { roleId }, select: userSelect });
  }

  async remove(id: string): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    return this.prisma.user.delete({ where: { id }, select: userSelect });
  }
}