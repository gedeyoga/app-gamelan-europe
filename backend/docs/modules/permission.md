# Module: Permission

Menu: [rbac.md](./rbac.md) (master) · [user.md](./user.md) · [role.md](./role.md) · [role-permissions.md](./role-permissions.md)

---

## 1. Deskripsi & Lokasi

Modul `permission` mengelola kode permission yang dipakai autorisasi. Permission berelasi N : M dengan role via `role_permissions`. Setiap permission punya `code` unik berformat `resource:action` (mis. `user:read`).

Lokasi kode:

```
libs/src/modules/permission/
├── permission.repository.ts
├── permission.service.ts
├── permission.controller.ts   ← tidak di libs; pindah ke apps/*/src/controllers/ (RULES bab 3)
├── permission.module.ts
├── dto/
│   ├── create-permission.dto.ts
│   ├── update-permission.dto.ts
│   └── match-code.dto.ts
└── entities/
    └── permission.entity.ts
```

- Modul bisnis & service di `libs/src/modules/permission/` (RULES bab 3).
- Controller di `apps/app/src/controllers/`.

---

## 2. Model Prisma

```prisma
model Permission {
  id          String           @id @default(uuid())
  code        String           @unique
  description String?
  roles       RolePermission[]
  createdAt   DateTime         @default(now()) @map("created_at")
  updatedAt   DateTime         @updatedAt @map("updated_at")

  @@map("permissions")
}

model RolePermission {
  roleId       String     @map("role_id")
  permissionId String     @map("permission_id")
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now()) @map("created_at")

  @@id([roleId, permissionId])
  @@map("role_permissions")
}
```

- `code` unik (constraint DB) → `P2002` dipetakan ke `ConflictException`.
- `onDelete: Cascade` pada `RolePermission.permission`: hapus permission otomatis menghapus baris join `role_permissions`.

---

## 3. Entity Payload Type

Pola `select` + `Prisma.GetPayload` (RULES bab 4).

```typescript
// libs/src/modules/permission/entities/permission.entity.ts
import { Prisma } from '@prisma/client';

export const permissionSelect = {
  id: true,
  code: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PermissionSelect;

export type PermissionEntity = Prisma.PermissionGetPayload<{
  select: typeof permissionSelect;
}>;
```

Varian minimal untuk daftar code permission seorang user (dipakai `PermissionsGuard`):

```typescript
export const permissionCodeSelect = {
  code: true,
} satisfies Prisma.PermissionSelect;
```

---

## 4. DTO

Status validasi gagal = **422** (RULES bab 7). Kontrak 422: `{ statusCode: 422, message: 'Validation failed', errors: [{ field, message }] }`. Semua `@Param('id')` pakai `ParseUUIDPipe`.

```typescript
// libs/src/modules/permission/dto/create-permission.dto.ts
import { Transform } from 'class-transformer';
import { Matches, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePermissionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z]+:[a-z]+$/, {
    message: 'code must match lowercase resource:action format',
  })
  code: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
```

```typescript
// libs/src/modules/permission/dto/update-permission.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreatePermissionDto } from './create-permission.dto';

export class UpdatePermissionDto extends PartialType(CreatePermissionDto) {}
```

```typescript
// libs/src/modules/permission/dto/match-code.dto.ts
import { Matches, IsString } from 'class-validator';

export class MatchCodeDto {
  @IsString()
  @Matches(/^[a-z]+:[a-z]+$/, { message: 'code must match lowercase resource:action format' })
  code: string;
}
```

---

## 5. Repository

Method penting dengan `select` + map error Prisma (RULES bab 6).

```typescript
// libs/src/modules/permission/permission.repository.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { permissionSelect, permissionCodeSelect, PermissionEntity } from './entities/permission.entity';

@Injectable()
export class PermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<PermissionEntity> {
    const permission = await this.prisma.permission.findUnique({ where: { id }, select: permissionSelect });
    if (!permission) throw new NotFoundException('Permission not found');
    return permission;
  }

  async findByCode(code: string): Promise<PermissionEntity | null> {
    return this.prisma.permission.findUnique({ where: { code }, select: permissionSelect });
  }

  async findAll(): Promise<PermissionEntity[]> {
    return this.prisma.permission.findMany({ select: permissionSelect });
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

  async delete(id: string): Promise<PermissionEntity> {
    const existing = await this.prisma.permission.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Permission not found');
    // onDelete: Cascade menghapus baris role_permissions terkait
    return this.prisma.permission.delete({ where: { id }, select: permissionSelect });
  }

  // dipakai PermissionsGuard — load code FRESH dari DB tiap request
  async findCodesByUserId(userId: string): Promise<string[]> {
    const rows = await this.prisma.rolePermission.findMany({
      where: { role: { users: { some: { id: userId } } } },
      select: { permission: { select: permissionCodeSelect } },
    });
    return rows.map((r) => r.permission.code);
  }
}
```

---

## 6. Service

Logika inti: validasi format `resource:action` di DTO + repository map `P2002`.

```typescript
// libs/src/modules/permission/permission.service.ts
import { Injectable } from '@nestjs/common';
import { PermissionRepository } from './permission.repository';

@Injectable()
export class PermissionService {
  constructor(private readonly permissionRepository: PermissionRepository) {}

  findAll() {
    return this.permissionRepository.findAll();
  }

  findOne(id: string) {
    return this.permissionRepository.findById(id);
  }

  create(dto: CreatePermissionDto) {
    return this.permissionRepository.create({ code: dto.code, description: dto.description });
  }

  update(id: string, dto: UpdatePermissionDto) {
    return this.permissionRepository.update(id, {
      code: dto.code,
      description: dto.description,
    });
  }

  remove(id: string) {
    return this.permissionRepository.delete(id);
  }

  // dipanggil PermissionsGuard — source of truth di DB
  getPermissionCodesByUserId(userId: string) {
    return this.permissionRepository.findCodesByUserId(userId);
  }
}
```

---

## 7. Endpoint

Semua path memakai prefix **`/api/v1`**. Respon sukses `{ data, message }`.

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| POST | `/api/v1/permissions` | Buat permission baru | PERMISSION: `permission:create` |
| GET | `/api/v1/permissions` | List semua permission | PERMISSION: `permission:read` |
| PATCH | `/api/v1/permissions/:id` | Update permission | PERMISSION: `permission:update` |
| DELETE | `/api/v1/permissions/:id` | Hapus permission (cascade ke join) | PERMISSION: `permission:delete` |

| Method / Path | Request body/params | Response | Error |
| --- | --- | --- | --- |
| `POST /permissions` | body `CreatePermissionDto` | 201 `{ data: <permission>, message }` | 409 code duplikat, 422 validasi |
| `GET /permissions` | query `?page=&limit=&search=&sortBy=&sortOrder=&filter[field]=` — `filter` whitelist `code, createdAt, updatedAt` (`createdAt, updatedAt` ISO 8601, dikoersi ke `Date` via `PERMISSION_DATE_FIELDS` + `parseDateInput`, invalid → 422, `like` ditolak); `search` OR like `code,description`; `sortBy` ∈ `code,description,createdAt,updatedAt` · contoh tanggal: `GET /permissions?filter[createdAt][gte]=2026-09-01T00:00:00Z` | 200 `{ data: [permission], message }` | 422 sortBy/filter tak dikenal |
| `PATCH /permissions/:id` | path `id`, body `UpdatePermissionDto` | 200 `{ data: <permission>, message }` | 404, 409 code duplikat, 422 |
| `DELETE /permissions/:id` | path `id` | 200 `{ data: <permission>, message }` | 404 |

Catatan: `GET /api/v1/permissions` dipakai internal `PermissionsResolver` untuk menerjemahkan `code` → id saat diff join.

---

## 8. Error & Exception

| Endpoint | Exception | Status | Penyebab |
| --- | --- | --- | --- |
| create/update | `ConflictException` | 409 | `code` duplikat (P2002) |
| semua | `NotFoundException` | 404 | permission tidak ditemukan |
| semua | `ForbiddenException` | 403 | JWT valid tapi permission kurang |
| semua | `UnauthorizedException` | 401 | JWT invalid/expired |
| semua | `UnprocessableEntityException` | 422 | validasi DTO (format code salah, dsb.) |
| semua | `BadRequestException` | 400 | payload/query tidak dapat dipahami |

Format error standar: `{ statusCode, message, errors }` (RULES bab 5).