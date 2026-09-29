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

  async findByIds(ids: string[]): Promise<UserEntity[]> {
    if (ids.length === 0) return [];
    return this.prisma.user.findMany({ where: { id: { in: ids } }, select: userSelect });
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

  async create(data: Prisma.UserUncheckedCreateInput): Promise<UserEntity> {
    try {
      return await this.prisma.user.create({ data, select: userSelect });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw this.toUniqueConstraintError(e);
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw this.toForeignKeyConstraintError(e);
      }
      throw e;
    }
  }

  async update(id: string, data: Prisma.UserUncheckedUpdateInput): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('User not found');
    try {
      return await this.prisma.user.update({ where: { id }, data, select: userSelect });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw this.toUniqueConstraintError(e);
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw this.toForeignKeyConstraintError(e);
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

  // P2003 mengidentifikasi FK lewat `meta.field_name` (nama kolom) atau, di Postgres
  // versi Prisma ini, `meta.constraint` (mis. `users_country_id_fkey`). Keduanya didukung;
  // FK tak dikenal → 422 generik, jangan salah label.
  private toForeignKeyConstraintError(e: Prisma.PrismaClientKnownRequestError): UnprocessableEntityException {
    const meta = e.meta as { field_name?: string; constraint?: string } | undefined;
    const byColumn: Record<string, { field: string; message: string }> = {
      country_id: { field: 'countryId', message: 'Country not found' },
      state_id: { field: 'stateId', message: 'State not found' },
      role_id: { field: 'roleId', message: 'Role not found' },
      network_id: { field: 'networkId', message: 'Network not found' },
    };
    const column =
      meta?.field_name && byColumn[meta.field_name]
        ? meta.field_name
        : Object.keys(byColumn).find((key) => (meta?.constraint ?? '').includes(key)) ??
          meta?.field_name ??
          '';
    const mapped = byColumn[column] ?? { field: column || 'unknown', message: 'Related record not found' };
    return new UnprocessableEntityException({
      message: 'Validation failed',
      errors: [mapped],
    });
  }

  async updateRole(id: string, roleId: string): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('User not found');

    const role = await this.prisma.role.findUnique({ where: { id: roleId }, select: { id: true } });
    if (!role) throw new NotFoundException('Role not found');

    return this.prisma.user.update({ where: { id }, data: { roleId }, select: userSelect });
  }

  async remove(id: string): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('User not found');
    return this.prisma.user.delete({ where: { id }, select: userSelect });
  }
}