import { ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash as argon2Hash } from '@node-rs/argon2';
import { Prisma } from '@prisma/client';
import { AccessScopeService } from '@app/libs/core/auth/access-scope.service';
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
    private readonly accessScope: AccessScopeService,
    private readonly roleRepository: RoleRepository,
  ) {}

  // update/remove/assignRole tetap admin-only (org/member tak punya `user:update`/`user:delete`).
  private async assertAdminScope(userId: string): Promise<void> {
    if ((await this.accessScope.resolve(userId)).kind !== 'all') {
      throw new ForbiddenException('Forbidden resource');
    }
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
    const scope = await this.accessScope.resolve(userId);
    let roleId: string | undefined;
    let organizationId: string | undefined;

    if (scope.kind === 'all') {
      // Admin: teruskan apa adanya.
      roleId = dto.roleId;
      organizationId = dto.organizationId;
    } else if (scope.kind === 'organization') {
      // Org: paksa member + organisasinya sendiri (abaikan roleId/organizationId dari body).
      organizationId = scope.organizationId;
      const member = await this.roleRepository.findByCode('member');
      if (!member) throw new InternalServerErrorException('Member role not configured');
      roleId = member.id;
    } else {
      // none/published tidak boleh membuat user.
      throw new ForbiddenException('Forbidden resource');
    }

    const passwordHash = await argon2Hash(dto.password, this.argon2Options());
    return this.userRepository.create({
      email: dto.email,
      fullName: dto.fullName,
      passwordHash,
      status: dto.status,
      countryId: dto.countryId,
      roleId,
      organizationId,
    });
  }

  async list(query: ListQueryDto, userId: string): Promise<{ items: UserEntity[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, USER_SORT_FIELDS);
    const scope = await this.accessScope.resolve(userId);
    if (scope.kind === 'none') return { items: [], total: 0 };
    if (scope.kind === 'published') throw new ForbiddenException('Forbidden resource');
    const filterWhere = buildWhere<Prisma.UserWhereInput>(query.filter, USER_FILTER_FIELDS, {
      enumFields: { status: ['ACTIVE', 'INACTIVE', 'BLOCKED'] },
      dateFields: USER_DATE_FIELDS,
    });
    const searchWhere = buildSearch<Prisma.UserWhereInput>(query.search, USER_SEARCHABLE_FIELDS);
    const sw = scope.kind === 'organization' ? { organizationId: scope.organizationId } : undefined;
    const scopedFilter = sw ? { AND: [sw, filterWhere] } : filterWhere;
    const where = combineWhere<Prisma.UserWhereInput>(
      scopedFilter as unknown as Record<string, unknown>,
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
    const [user, scope] = await Promise.all([
      this.userRepository.findById(id),
      this.accessScope.resolve(userId),
    ]);
    if (scope.kind === 'all') return user;
    if (scope.kind === 'organization' && user.organizationId === scope.organizationId) return user;
    throw new ForbiddenException('Forbidden resource');
  }

  async update(id: string, dto: UpdateUserDto, userId: string): Promise<UserEntity> {
    await this.assertAdminScope(userId);
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
    await this.assertAdminScope(userId);
    return this.userRepository.updateRole(id, roleId);
  }

  async remove(id: string, userId: string): Promise<UserEntity> {
    await this.assertAdminScope(userId);
    return this.userRepository.remove(id);
  }
}