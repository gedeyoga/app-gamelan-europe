import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash as argon2Hash } from '@node-rs/argon2';
import { Prisma } from '@prisma/client';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { UserRepository } from './user.repository';
import { UserEntity } from './entities/user.entity';
import { RegisterUserDto } from './dto/register-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export const USER_FILTER_FIELDS = ['email', 'fullName', 'status', 'roleId', 'createdAt', 'updatedAt'];
export const USER_DATE_FIELDS = ['createdAt', 'updatedAt'];
// Semua kolom yang ditampilkan di menu Users wajib sortable.
export const USER_SORT_FIELDS = ['fullName', 'email', 'status', 'roleName', 'createdAt', 'updatedAt'];
// Global search bar menu Users: OR like ke kolom-kolom ini.
export const USER_SEARCHABLE_FIELDS = ['fullName', 'email'];
// Kolom tampil relasi → path Prisma.
export const USER_SORT_MAP: Record<string, string> = { roleName: 'role.name' };

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly config: ConfigService,
  ) {}

  private argon2Options() {
    return {
      algorithm: 2 as const,
      memoryCost: Number(this.config.get('ARGON2_MEMORY_COST', '65536')),
      timeCost: Number(this.config.get('ARGON2_TIME_COST', '3')),
      parallelism: Number(this.config.get('ARGON2_PARALLELISM', '4')),
    };
  }

  async register(dto: RegisterUserDto): Promise<UserEntity> {
    const passwordHash = await argon2Hash(dto.password, this.argon2Options());
    return this.userRepository.create({
      email: dto.email,
      fullName: dto.fullName,
      passwordHash,
    });
  }

  async create(dto: CreateUserDto): Promise<UserEntity> {
    const passwordHash = await argon2Hash(dto.password, this.argon2Options());
    return this.userRepository.create({
      email: dto.email,
      fullName: dto.fullName,
      passwordHash,
      status: dto.status,
    });
  }

  async list(query: ListQueryDto): Promise<{ items: UserEntity[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, USER_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.UserWhereInput>(query.filter, USER_FILTER_FIELDS, {
      enumFields: { status: ['ACTIVE', 'INACTIVE', 'BLOCKED'] },
      dateFields: USER_DATE_FIELDS,
    });
    const searchWhere = buildSearch<Prisma.UserWhereInput>(query.search, USER_SEARCHABLE_FIELDS);
    const where = combineWhere<Prisma.UserWhereInput>(
      filterWhere as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    return this.userRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.UserOrderByWithRelationInput>(
        query.sortBy,
        query.sortOrder,
        USER_SORT_MAP,
      ),
    });
  }

  findOne(id: string): Promise<UserEntity> {
    return this.userRepository.findById(id);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const data: Prisma.UserUpdateInput = {};
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.password !== undefined) {
      data.passwordHash = await argon2Hash(dto.password, this.argon2Options());
    }
    if (Object.keys(data).length === 0) {
      return this.findOne(id);
    }
    return this.userRepository.update(id, data);
  }

  assignRole(id: string, roleId: string): Promise<UserEntity> {
    return this.userRepository.updateRole(id, roleId);
  }

  remove(id: string): Promise<UserEntity> {
    return this.userRepository.remove(id);
  }
}