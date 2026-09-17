# Module: Role-Permissions

Menu: [rbac.md](./rbac.md) (master) · [user.md](./user.md) · [role.md](./role.md) · [permission.md](./permission.md)

---

## 1. Deskripsi & Lokasi

Modul `role-permissions` mengelola relasi N : M antara role dan permission (tabel join `role_permissions`). Menyediakan operasi **replace set** permission dari sebuah role dan read daftar permission milik role.

Lokasi kode:

```
libs/src/modules/role-permissions/
├── role-permission.repository.ts
├── role-permission.service.ts
├── role-permission.controller.ts   ← tidak di libs; pindah ke apps/*/src/controllers/ (RULES bab 3)
├── role-permission.module.ts
├── dto/
│   └── replace-role-permissions.dto.ts
└── entities/
    └── role-permission.entity.ts
```

- Modul bisnis & service di `libs/src/modules/role-permissions/` (RULES bab 3).
- Controller di `apps/app/src/controllers/`.

Relasi join didefinisikan di `libs/prisma/schema.prisma`; module ini hanya memakai-nya via `RolePermission` (Prisma).

---

## 2. Model Prisma

```prisma
model RolePermission {
  roleId       String     @map("role_id")
  permissionId String     @map("permission_id")
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now()) @map("created_at")

  @@id([roleId, permissionId])
  @@map("role_permissions")
}

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

model Permission {
  id          String           @id @default(uuid())
  code        String           @unique
  description String?
  roles       RolePermission[]
  createdAt   DateTime         @default(now()) @map("created_at")
  updatedAt   DateTime         @updatedAt @map("updated_at")

  @@map("permissions")
}
```

Catatan cascading `onDelete`:

- Hapus `Role` → baris `role_permissions` terhapus otomatis.
- Hapus `Permission` → baris `role_permissions` terhapus otomatis.
- Composite PK `@@id([roleId, permissionId])` mencegah duplikasi pasangan (kebetulan juga menghalau `P2002` saat `createMany`; replace pakai `deleteMany` dulu jadi aman).

---

## 3. Entity Payload Type

Response read memakai select dari join + child `Permission`:

```typescript
// libs/src/modules/role-permissions/entities/role-permission.entity.ts
import { Prisma } from '@prisma/client';

export const rolePermissionSelect = {
  roleId: true,
  permissionId: true,
  permission: { select: { id: true, code: true, description: true } },
} satisfies Prisma.RolePermissionSelect;

export type RolePermissionEntity = Prisma.RolePermissionGetPayload<{
  select: typeof rolePermissionSelect;
}>;
```

---

## 4. DTO

Status validasi gagal = **422** (RULES bab 7). Kontrak 422: `{ statusCode: 422, message: 'Validation failed', errors: [{ field, message }] }`. `@Param('id')` pakai `ParseUUIDPipe`.

```typescript
// libs/src/modules/role-permissions/dto/replace-role-permissions.dto.ts
import { Transform, TransformFnParams } from 'class-transformer';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReplaceRolePermissionsDto {
  @Transform(({ value }: TransformFnParams) =>
    Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim() : v)) : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  permissionIds: string[];
}
```

> `permissionIds` wajib berupa array **minimal 1 UUID** (`@ArrayMinSize(1)` + `@IsUUID(each)`). Array kosong → 422 (bukan clear). `PUT` tetap replace penuh, bukan delta.

### Tabel validasi & contoh 422

| Field | Aturan | Gagal → |
| --- | --- | --- |
| `permissionIds` | array, `@ArrayMinSize(1)`, tiap item `@IsUUID()` + trim | 422 `{ field: 'permissionIds', message }` / `{ field: 'permissionIds.0', message }` |
| `:id` path | `ParseUUIDPipe` | 422/400 UUID invalid |

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [{ "field": "permissionIds.0", "message": "each value in permissionIds must be a UUID" }]
}
```

---

## 5. Repository

Operasi replace memakai **`$transaction`** (RULES bab 6: multi-tabel wajib transaksi).

```typescript
// libs/src/modules/role-permissions/role-permission.repository.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { rolePermissionSelect, RolePermissionEntity } from './entities/role-permission.entity';

@Injectable()
export class RolePermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async assertRoleExists(roleId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id: roleId }, select: { id: true } });
    if (!role) throw new NotFoundException('Role not found');
  }

  async findPermissionsByRoleId(roleId: string): Promise<RolePermissionEntity[]> {
    await this.assertRoleExists(roleId);
    return this.prisma.rolePermission.findMany({
      where: { roleId },
      select: rolePermissionSelect,
    });
  }

  async replacePermissions(roleId: string, permissionIds: string[]): Promise<RolePermissionEntity[]> {
    await this.assertRoleExists(roleId);

    // pastikan semua permissionIds ada (hindari FK error) — optional pre-check
    const count = await this.prisma.permission.count({ where: { id: { in: permissionIds } } });
    if (count !== permissionIds.length) throw new NotFoundException('Permission not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      });
      return tx.rolePermission.findMany({ where: { roleId }, select: rolePermissionSelect });
    });
  }
}
```

---

## 6. Service

```typescript
// libs/src/modules/role-permissions/role-permission.service.ts
import { Injectable } from '@nestjs/common';
import { RolePermissionRepository } from './role-permission.repository';

@Injectable()
export class RolePermissionService {
  constructor(private readonly rolePermissionRepository: RolePermissionRepository) {}

  getPermissionsByRole(roleId: string) {
    return this.rolePermissionRepository.findPermissionsByRoleId(roleId);
  }

  replacePermissions(roleId: string, permissionIds: string[]) {
    return this.rolePermissionRepository.replacePermissions(roleId, permissionIds);
  }
}
```

Pola replace (final):

```
validate role ada → validasi permissionIds → deleteMany lama → createMany baru → return list
```

Semua dalam satu `$transaction` — gagal di tengah → rollback, tidak ada state parsial.

---

## 7. Endpoint

Semua path memakai prefix **`/api/v1`**. Respon sukses `{ data, message }`.

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| PUT | `/api/v1/roles/:id/permissions` | Replace keseluruhan set permission role | PERMISSION: `permission:update` |
| GET | `/api/v1/roles/:id/permissions` | List permission (id + code) milik role | PERMISSION: `permission:read` |

| Method / Path | Request body/params | Response | Error |
| --- | --- | --- | --- |
| `PUT /roles/:id/permissions` | path `id`, body `{ permissionIds: string[] }` | 200 `{ data: [{ roleId, permissionId, permission: { id, code } }], message }` | 404 role tidak ada, 404 permission tidak ada, 422 validasi |
| `GET /roles/:id/permissions` | path `id` | 200 `{ data: [{ roleId, permissionId, permission: { id, code } }], message }` | 404 role tidak ada |

---

## 8. Error & Exception

| Endpoint | Exception | Status | Penyebab |
| --- | --- | --- | --- |
| PUT | `NotFoundException` | 404 | role tidak ada (`assertRoleExists`) |
| PUT | `NotFoundException` | 404 | salah satu `permissionId` tidak ada |
| PUT | `UnprocessableEntityException` | 422 | `permissionIds` bukan array / kosong (`@ArrayMinSize(1)`) / berisi non-UUID |
| GET | `NotFoundException` | 404 | role tidak ada |
| semua | `ForbiddenException` | 403 | JWT valid tapi permission kurang |
| semua | `UnauthorizedException` | 401 | JWT invalid/expired |
| semua | `BadRequestException` | 400 | payload/query tidak dapat dipahami |

Format error standar: `{ statusCode, message, errors }` (RULES bab 5).