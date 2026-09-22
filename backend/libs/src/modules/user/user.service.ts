import { ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash as argon2Hash } from '@node-rs/argon2';
import { Prisma } from '@prisma/client';
import { hasAdminAccess } from '@app/libs/modules/permission/permission.constants';
import { PermissionService } from '@app/libs/modules/permission/permission.service';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { UserRepository } from './user.repository';
import { UserEntity } from './entities/user.entity';
import { RegisterUserDto } from './dto/register-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RoleRepository } from '@app/libs/modules/role/role.repository';

export const USER_FILTER_FIELDS = ['email', 'fullName', 'status', 'roleId', 'countryId', 'createdAt', 'updatedAt'];
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
    private readonly permissionService: PermissionService,
    private readonly roleRepository: RoleRepository,
  ) {}

  // Gerbang manajemen user berbasis permission eksplisit `admin:access` — BUKAN scope konten
  // (cegah eskalasi: role dengan `event:publish`/`user:create` bukan admin).
  private async assertAdmin(userId: string): Promise<void> {
    const codes = await this.permissionService.getPermissionCodesByUserId(userId);
    if (!hasAdminAccess(codes)) throw new ForbiddenException('Forbidden resource');
  }

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
    const base: Prisma.UserUncheckedCreateInput = {
      email: dto.email,
      fullName: dto.fullName,
      passwordHash,
      phone: dto.phone,
      countryId: dto.countryId,
    };

    if (dto.organizationName) {
      const role = await this.roleRepository.findByCode('organization');
      if (!role) throw new InternalServerErrorException('Organization role not configured');
      return this.userRepository.createWithOrganization({ ...base, roleId: role.id }, dto.organizationName);
    }

    return this.userRepository.create(base);
  }

  async create(dto: CreateUserDto, userId: string): Promise<UserEntity> {
    await this.assertAdmin(userId);
    const passwordHash = await argon2Hash(dto.password, this.argon2Options());
    return this.userRepository.create({
      email: dto.email,
      fullName: dto.fullName,
      passwordHash,
      status: dto.status,
      countryId: dto.countryId,
      roleId: dto.roleId,
      organizationId: dto.organizationId,
    });
  }

  async list(query: ListQueryDto, userId: string): Promise<{ items: UserEntity[]; total: number }> {
    await this.assertAdmin(userId);
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

  async findOne(id: string, userId: string): Promise<UserEntity> {
    await this.assertAdmin(userId);
    return this.userRepository.findById(id);
  }

  async update(id: string, dto: UpdateUserDto, userId: string): Promise<UserEntity> {
    await this.assertAdmin(userId);
    const data: Prisma.UserUncheckedUpdateInput = {};
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.countryId !== undefined) data.countryId = dto.countryId;
    if (dto.password !== undefined) {
      data.passwordHash = await argon2Hash(dto.password, this.argon2Options());
    }
    if (Object.keys(data).length === 0) {
      return this.findOne(id, userId);
    }
    return this.userRepository.update(id, data);
  }

  async assignRole(id: string, roleId: string, userId: string): Promise<UserEntity> {
    await this.assertAdmin(userId);
    return this.userRepository.updateRole(id, roleId);
  }

  async remove(id: string, userId: string): Promise<UserEntity> {
    await this.assertAdmin(userId);
    return this.userRepository.remove(id);
  }
}