# Module: Role

Menu: [rbac.md](./rbac.md) (master) · [user.md](./user.md) · [permission.md](./permission.md) · [role-permissions.md](./role-permissions.md)

---

## 1. Deskripsi & Lokasi

Modul `role` mengelola role pengguna. Role dimiliki banyak user (1 : N) dan berisi banyak permission (N : M via `role_permissions`).

Lokasi kode:

```
libs/src/modules/role/
├── role.repository.ts
├── role.service.ts
├── role.controller.ts   ← tidak di libs; pindah ke apps/*/src/controllers/ (RULES bab 3)
├── role.module.ts
├── dto/
│   ├── create-role.dto.ts
│   └── update-role.dto.ts
└── entities/
    └── role.entity.ts
```

- Modul bisnis & service di `libs/src/modules/role/` (RULES bab 3).
- Controller di `apps/app/src/controllers/`.

---

## 2. Model Prisma

```prisma
model Role {
  id          String           @id @default(uuid())
  name        String           @unique
  description String?
  permissions RolePermission[]
  users       User[]
  createdAt   DateTime         @default(now()) @map("created_at")
  updatedAt   DateTime         @updatedAt @map("updated_at")

  @@map("roles")
}

model User {
  id           String     @id @default(uuid())
  email        String     @unique
  fullName     String     @map("full_name")
  passwordHash String     @map("password_hash")
  status       UserStatus @default(ACTIVE)
  roleId       String?    @map("role_id")
  role         Role?      @relation(fields: [roleId], references: [id])
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @updatedAt @map("updated_at")

  @@map("users")
}
```

- `name` unik (constraint DB) → `P2002` dipetakan ke `ConflictException`.
- `users` relasi 1:N — dipakai untuk menolak hapus role yang masih dipakai.

### Keputusan hapus role

Saat `DELETE /roles/:id` dan role masih dipakai oleh **minimal satu user** (relasi `roleId` terisi), hapus **ditolak** → `ConflictException` (409). Tidak ada cascade/soft-block pada iterasi ini.

```typescript
// keputusan: tolak hapus bila masih ada user memakai role
if (userCount > 0) throw new ConflictException('Role is still assigned to users');
```

---

## 3. Entity Payload Type

Pola `select` + `Prisma.GetPayload` (RULES bab 4).

```typescript
// libs/src/modules/role/entities/role.entity.ts
import { Prisma } from '@prisma/client';

export const roleSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RoleSelect;

export type RoleEntity = Prisma.RoleGetPayload<{ select: typeof roleSelect }>;
```

Varian dengan daftar permission (dipakai list/detail bersama join table):

```typescript
export const roleWithPermissionsSelect = {
  id: true,
  name: true,
  description: true,
  permissions: { select: { permissionId: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RoleSelect;

export type RoleWithPermissionsEntity = Prisma.RoleGetPayload<{
  select: typeof roleWithPermissionsSelect;
}>;
```

---

## 4. DTO

Status validasi gagal = **422** (RULES bab 7). Kontrak 422: `{ statusCode: 422, message: 'Validation failed', errors: [{ field, message }] }`. Semua `@Param('id')` pakai `ParseUUIDPipe`.

```typescript
// libs/src/modules/role/dto/create-role.dto.ts
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
```

```typescript
// libs/src/modules/role/dto/update-role.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateRoleDto } from './create-role.dto';

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
```

### Tabel validasi & contoh 422

| Field | Aturan | Gagal → |
| --- | --- | --- |
| `name` | trim, `@IsString()`, `@MaxLength(50)` | 422 `{ field: 'name', message }` |
| `description` | trim opsional, `@MaxLength(255)` | 422 `{ field: 'description', message }` |
| `:id` path | `ParseUUIDPipe` | 422/400 UUID invalid |

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [{ "field": "name", "message": "name should not be empty" }]
}
```

---

## 5. Repository

Method penting dengan `select` + map error Prisma (RULES bab 6).

```typescript
// libs/src/modules/role/role.repository.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { roleSelect, roleWithPermissionsSelect, RoleEntity, RoleWithPermissionsEntity } from './entities/role.entity';

@Injectable()
export class RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<RoleEntity> {
    const role = await this.prisma.role.findUnique({ where: { id }, select: roleSelect });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async findByIdWithPermissions(id: string): Promise<RoleWithPermissionsEntity> {
    const role = await this.prisma.role.findUnique({ where: { id }, select: roleWithPermissionsSelect });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async findAll(): Promise<RoleEntity[]> {
    return this.prisma.role.findMany({ select: roleSelect });
  }

  async create(data: Prisma.RoleCreateInput): Promise<RoleEntity> {
    try {
      return await this.prisma.role.create({ data, select: roleSelect });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Role already exists');
      }
      throw e;
    }
  }

  async update(id: string, data: Prisma.RoleUpdateInput): Promise<RoleEntity> {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Role not found');
    try {
      return await this.prisma.role.update({ where: { id }, data, select: roleSelect });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Role already exists');
      }
      throw e;
    }
  }

  async delete(id: string): Promise<RoleEntity> {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Role not found');

    const userCount = await this.prisma.user.count({ where: { roleId: id } });
    if (userCount > 0) throw new ConflictException('Role is still assigned to users');

    return this.prisma.role.delete({ where: { id }, select: roleSelect });
  }
}
```

---

## 6. Service

Logika inti: delegasi repository, validasi name unik otomatis lewat map `P2002`.

```typescript
// libs/src/modules/role/role.service.ts
import { Injectable } from '@nestjs/common';
import { RoleRepository } from './role.repository';

@Injectable()
export class RoleService {
  constructor(private readonly roleRepository: RoleRepository) {}

  findAll() {
    return this.roleRepository.findAll();
  }

  findOne(id: string) {
    return this.roleRepository.findById(id);
  }

  create(dto: CreateRoleDto) {
    return this.roleRepository.create({ name: dto.name, description: dto.description });
  }

  update(id: string, dto: UpdateRoleDto) {
    return this.roleRepository.update(id, {
      name: dto.name,
      description: dto.description,
    });
  }

  remove(id: string) {
    return this.roleRepository.delete(id);
  }
}
```

---

## 7. Endpoint

Semua path memakai prefix **`/api/v1`**. Respon sukses `{ data, message }`.

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| POST | `/api/v1/roles` | Buat role baru | PERMISSION: `role:create` |
| GET | `/api/v1/roles` | List semua role | PERMISSION: `role:read` |
| GET | `/api/v1/roles/:id` | Detail role + permission | PERMISSION: `role:read` |
| PATCH | `/api/v1/roles/:id` | Update role | PERMISSION: `role:update` |
| DELETE | `/api/v1/roles/:id` | Hapus role (tolak bila masih dipakai user) | PERMISSION: `role:delete` |

| Method / Path | Request body/params | Response | Error |
| --- | --- | --- | --- |
| `POST /roles` | body `CreateRoleDto` | 201 `{ data: <role>, message }` | 409 name duplikat, 422 validasi |
| `GET /roles` | query `?page=&limit=&search=&sortBy=&sortOrder=&filter[field]=` — `filter` whitelist `name, createdAt, updatedAt` (`createdAt, updatedAt` ISO 8601, dikoersi ke `Date` via `ROLE_DATE_FIELDS` + `parseDateInput`, invalid → 422, `like` ditolak); `search` OR like `name,description`; `sortBy` ∈ `name,description,createdAt,updatedAt` · contoh tanggal: `GET /roles?filter[createdAt][gte]=2026-09-01T00:00:00Z` | 200 `{ data: [role], message }` | 422 sortBy/filter tak dikenal |
| `GET /roles/:id` | path `id` | 200 `{ data: <role + permissions>, message }` | 404 tidak ditemukan |
| `PATCH /roles/:id` | path `id`, body `UpdateRoleDto` | 200 `{ data: <role>, message }` | 404, 409 name duplikat, 422 |
| `DELETE /roles/:id` | path `id` | 200 `{ data: <role>, message }` | 404, 409 masih dipakai user |

---

## 8. Error & Exception

| Endpoint | Exception | Status | Penyebab |
| --- | --- | --- | --- |
| create/update | `ConflictException` | 409 | `name` duplikat (P2002) |
| delete | `ConflictException` | 409 | role masih dipakai minimal satu user |
| semua | `NotFoundException` | 404 | role tidak ditemukan |
| semua | `ForbiddenException` | 403 | JWT valid tapi permission kurang |
| semua | `UnauthorizedException` | 401 | JWT invalid/expired |
| semua | `UnprocessableEntityException` | 422 | validasi DTO |
| semua | `BadRequestException` | 400 | payload/query tidak dapat dipahami |

Format error standar: `{ statusCode, message, errors }` (RULES bab 5).