# Module: User

Menu: [rbac.md](./rbac.md) (master) · [role.md](./role.md) · [permission.md](./permission.md) · [role-permissions.md](./role-permissions.md)

---

## 1. Deskripsi & Lokasi

Modul `user` menangani registrasi, login (auth), dan CRUD akun pengguna. User dimiliki oleh max satu role (`user` 1 : N `role`).

Lokasi kode:

```
libs/src/modules/user/
├── user.repository.ts
├── user.service.ts
├── user-content-purge.service.ts   ← orkestrasi delete user (+ cascade konten author)
├── user-content-purge.module.ts
├── user.controller.ts   ← tidak di libs; pindah ke apps/*/src/controllers/ (RULES bab 3)
├── user.module.ts
├── dto/
│   ├── register-user.dto.ts
│   ├── login.dto.ts
│   ├── create-user.dto.ts
│   ├── update-user.dto.ts
│   ├── update-user-role.dto.ts
│   └── delete-user-query.dto.ts
└── entities/
    └── user.entity.ts
```

- Modul bisnis & service di `libs/src/modules/user/` (RULES bab 3).
- Controller di `apps/app/src/controllers/` — service dipakai dari sana, bukan dari libs.

### Keputusan desain

Create user via **register tetap PUBLIC** (`POST /api/v1/auth/register`), sedangkan pembuatan user oleh admin menggunakan permission `user:create`. Ringkasannya:

| Skenario | Jalur | Akses |
| --- | --- | --- |
| User mendaftar sendiri | `POST /api/v1/auth/register` | PUBLIC |
| Admin membuatkan akun | `POST /api/v1/users` (CreateUserDto) | PERMISSION: `user:create` |

---

## 2. Model Prisma

```prisma
model User {
  id             String         @id @default(uuid())
  email          String         @unique
  fullName       String         @map("full_name")
  phone          String?
  address        String?
  countryId      String?        @map("country_id")
  country        Country?       @relation(fields: [countryId], references: [iso2], onDelete: SetNull)
  passwordHash   String         @map("password_hash")
  status         UserStatus     @default(ACTIVE)
  roleId         String?        @map("role_id")
  role           Role?          @relation(fields: [roleId], references: [id], onDelete: SetNull)
  networkId      String?
  network        Network?       @relation(fields: [networkId], references: [id], onDelete: SetNull)
  refreshTokens  RefreshToken[]
  billings       Billing[]
  events         Event[]        @relation("EventCreator")
  posts          Post[]         @relation("PostCreator")
  createdAt      DateTime       @default(now()) @map("created_at")
  updatedAt      DateTime       @updatedAt @map("updated_at")

  @@index([roleId])
  @@index([networkId])
  @@index([countryId])
  @@map("users")
}

enum UserStatus {
  ACTIVE
  INACTIVE
  BLOCKED
}
```

- `email` unik (constraint DB) → `P2002` dipetakan ke `UnprocessableEntityException` (422) via `toUniqueConstraintError`.
- `roleId` nullable: user boleh belum punya role (didapat setelah di-assign).
- `countryId` (ISO-2) nullable → FK ke `Country.iso2`, `onDelete: SetNull`, diindeks (`@@index([countryId])`). `roleId`/`networkId` juga diindeks.
- `countryId` tidak ada di tabel → `P2003` dipetakan ke `UnprocessableEntityException` (422) field `countryId` (`toForeignKeyConstraintError`).

---

## 3. Entity Payload Type

Pola `select` + `Prisma.GetPayload` (RULES bab 4).

> **CATATAN:** select user **tidak pernah** menyertakan `passwordHash`. `passwordHash` hanya dibaca di internal service (login/verify), tidak pernah keluar dari API.

```typescript
// libs/src/modules/user/entities/user.entity.ts
import { Prisma } from '@prisma/client';

export const userSelect = {
  id: true,
  email: true,
  fullName: true,
  status: true,
  roleId: true,
  role: { select: { id: true, name: true } },
  countryId: true,
  country: { select: { id: true, iso2: true, name: true } },
  networkId: true,
  network: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type UserEntity = Prisma.UserGetPayload<{ select: typeof userSelect }>;
```

Select internal untuk auth (login) — tetap tak pernah dikirim ke response, hanya dipakai memverifikasi password:

```typescript
const userWithPasswordSelect = {
  id: true,
  email: true,
  passwordHash: true,
  status: true,
  roleId: true,
} satisfies Prisma.UserSelect;

export type UserAuthEntity = Prisma.UserGetPayload<{ select: typeof userWithPasswordSelect }>;
```

---

## 4. DTO

Status validasi gagal = **422** (`ValidationPipe` di app+worker: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`, `errorHttpStatusCode: 422` — RULES bab 7). Kontrak 422: `{ statusCode: 422, message: 'Validation failed', errors: [{ field, message }] }` (`field` = property, mis. `email`, `permissionIds.0`). Semua `@Param('id')` pakai `ParseUUIDPipe`.

```typescript
// libs/src/modules/user/dto/register-user.dto.ts
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterUserDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
```

```typescript
// libs/src/modules/user/dto/login.dto.ts
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
```

```typescript
// libs/src/modules/user/dto/create-user.dto.ts
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Length, MaxLength, MinLength } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class CreateUserDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName: string;

  // RULES exception: password jangan di-trim (spasi leading/trailing signifikan).
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  // ISO-2 country code (relasi ke Country.iso2).
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryId?: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsUUID()
  networkId?: string;
}
```

```typescript
// libs/src/modules/user/dto/update-user.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

// UpdateUserDto = CreateUserDto dengan semua field opsional;
// password di sini sudah di-hash di service, bukan dikirim sebagai password polos.
export class UpdateUserDto extends PartialType(CreateUserDto) {}
```

```typescript
// libs/src/modules/user/dto/update-user-role.dto.ts
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class UpdateUserRoleDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsUUID()
  @IsNotEmpty()
  roleId: string; // null untuk melepas role belum disupport di iterasi ini
}
```

```typescript
// libs/src/modules/user/dto/delete-user-query.dto.ts
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class DeleteUserQueryDto {
  // FE mengirim `?cascadeContent=true` (string). Absen → undefined (jalur delete default).
  @Transform(({ value }) => (value === undefined ? undefined : value === true || value === 'true'))
  @IsOptional()
  @IsBoolean()
  cascadeContent?: boolean;
}
```

> `UpdateUserDto` memperluas `CreateUserDto` (PartialType) sehingga `email`/`fullName`/`status`/`countryId` tetap tervalidasi bila dikirim. `password` pada update tidak lewat `UpdateUserDto` — hash di service.

### Tabel validasi & contoh 422

| Field | Aturan | Gagal → |
| --- | --- | --- |
| `email` | trim, `@IsEmail()`, `@MaxLength(255)` | 422 `{ field: 'email', message }` |
| `fullName` | trim, `@IsString()`, `@MaxLength(100)` | 422 `{ field: 'fullName', message }` |
| `password` | trim, `@MinLength(8)`, `@MaxLength(128)` | 422 `{ field: 'password', message }` |
| `status` | opsional, `@IsEnum(UserStatus)` | 422 `{ field: 'status', message }` |
| `countryId` | trim opsional, `@Length(2, 2)` (ISO-2, relasi `Country.iso2`) | 422 `{ field: 'countryId', message }` |
| `roleId` | opsional, `@IsUUID()` (create: assign role; `UpdateUserDto` mewarisinya tapi diabaikan service — pakai `PATCH /users/:id/role`) | 422 `{ field: 'roleId', message }` |
| `networkId` | opsional, `@IsUUID()` (create: pindah user ke network; `UpdateUserDto` mewarisinya, service update belum menerapkannya) | 422 `{ field: 'networkId', message }` |
| `roleId` (assign) | trim, `@IsUUID()` | 422 `{ field: 'roleId', message }` |
| `:id` path | `ParseUUIDPipe` | 422/400 UUID invalid |
| `cascadeContent` (query) | opsional, `@IsBoolean()` (string `"true"` di-coerce ke `boolean`; absen = `undefined`) | 422 `{ field: 'cascadeContent', message }` |

```json
// POST /users dengan email invalid
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "email must be an email" }]
}
```

---

## 5. Repository

Method penting dengan `select` + map error Prisma (RULES bab 6).

```typescript
// libs/src/modules/user/user.repository.ts
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

  // Input sengaja `Unchecked*` supaya bisa menulis FK scalar (`countryId`, `roleId`).
  async create(data: Prisma.UserUncheckedCreateInput): Promise<UserEntity> {
    try {
      return await this.prisma.user.create({ data, select: userSelect });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw this.toUniqueConstraintError(e); // email duplikat → 422
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw this.toForeignKeyConstraintError(e); // countryId tak ada → 422
      }
      throw e;
    }
  }

  async update(id: string, data: Prisma.UserUncheckedUpdateInput): Promise<UserEntity> {
    // Pre-check pakai select minimal → tidak menyentuh kolom drift (phone/address/network_id).
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

  // P2003: FK diidentifikasi lewat meta.field_name (nama kolom) atau meta.constraint
  // (Postgres, mis. `users_country_id_fkey`). FK tak dikenal → 422 generik, jangan salah label.
  private toForeignKeyConstraintError(e: Prisma.PrismaClientKnownRequestError): UnprocessableEntityException {
    const meta = e.meta as { field_name?: string; constraint?: string } | undefined;
    const byColumn: Record<string, { field: string; message: string }> = {
      country_id: { field: 'countryId', message: 'Country not found' },
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
    return new UnprocessableEntityException({ message: 'Validation failed', errors: [mapped] });
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
```

---

## 6. Service

Logika inti: hash password saat register, verify saat login, sign JWT.

```typescript
// libs/src/modules/user/user.service.ts
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as argon2 from '@node-rs/argon2';
import { JwtService } from '@nestjs/jwt';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterUserDto) {
    // hash password dengan argon2id — passwordHash tidak pernah keluar via select
    const passwordHash = await argon2.hash(dto.password, { algorithm: 2 });
    return this.userRepository.create({
      email: dto.email,
      fullName: dto.fullName,
      passwordHash,
    });
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findByEmailWithPassword(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    // catatan: user.status === 'BLOCKED' → tolak login (lempar UnauthorizedException)

    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    });
    // JWT_EXPIRES_IN dibaca dari config (bukan process.env langsung) — RULES bab 8

    return { accessToken, user: (await this.userRepository.findById(user.id)) };
  }
}
```

---

## 7. Endpoint

Semua path memakai prefix **`/api/v1`**. Respon sukses `{ data, message }`.

### Auth

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/register` | Register user baru (role default null) | PUBLIC |
| POST | `/api/v1/auth/login` | Login, verifikasi password, terbitkan JWT | PUBLIC |
| POST | `/api/v1/auth/logout` | Logout, blacklist token | LOGIN |
| POST | `/api/v1/auth/refresh` | Refresh token (rotasi) | PUBLIC |
| GET | `/api/v1/auth/me` | Profil user aktif + role + country + permissions | LOGIN |
| PATCH | `/api/v1/auth/me` | Update profil sendiri (`fullName`/`email`/`countryId`) | LOGIN |
| POST | `/api/v1/auth/change-password` | Ganti password sendiri (revoke semua refresh token) | LOGIN |

> Detail mekanisme auth (skema token, refresh rotation, logout Redis, guard, error) → **[`auth.md`](./auth.md)**.
> Response `/auth/me` → `{ data: { id, email, fullName, status, role, countryId, country, permissions }, message }` — `permissions` = array `permission.code` milik user.

Auth (register):

| Item | Nilai |
| --- | --- |
| Request body | `{ email, fullName, password }` (RegisterUserDto) |
| Response 201 | `{ data: <user tanpa password_hash>, message: 'success' }` |
| Validasi | `email` valid, `fullName` string non-empty, `password` min 8 → gagal = 422 |
| Error 409 | _tidak ada_ — email duplikat dipetakan ke 422 (`UnprocessableEntityException`) |
| Error 422 | validasi DTO / email sudah dipakai (`P2002`) |

Auth (login):

| Item | Nilai |
| --- | --- |
| Request body | `{ email, password }` (LoginDto) |
| Response 200 | `{ data: { accessToken, refreshToken, user }, message: 'success' }` |
| Error 401 | email tak ada / password salah (`UnauthorizedException`) |
| Error 422 | validasi DTO |

Auth (update profile — `PATCH /auth/me`):

| Item | Nilai |
| --- | --- |
| Request body | `UpdateProfileDto` — `{ fullName?, email?, countryId? }`; minimal satu field wajib diisi |
| Validasi | `fullName` ≤100, `email` valid, `countryId` `@Length(2, 2)` ISO-2 → gagal = 422 |
| Response 200 | `{ data: <hasil /auth/me>, message: 'success' }` |
| Error 400 | tidak ada field yang dikirim (`BadRequestException`) |
| Error 422 | validasi DTO; `countryId` tak ada (`P2003` → `{ field: 'countryId', message: 'Country not found' }`) |

### User CRUD

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| POST | `/api/v1/users` | Buat user oleh admin | PERMISSION: `user:create` |
| GET | `/api/v1/users` | List user (pagination + search + sort semua kolom tampil) | PERMISSION: `user:read` |
| GET | `/api/v1/users/:id` | Detail user | PERMISSION: `user:read` |
| PATCH | `/api/v1/users/:id` | Update user (email/fullName/status/countryId) | PERMISSION: `user:update` |
| PATCH | `/api/v1/users/:id/role` | Set role user | PERMISSION: `user:update` |
| DELETE | `/api/v1/users/:id` | Hapus user; `?cascadeContent=true` ikut menghapus konten yang user author | PERMISSION: `user:delete` |

Kontrak list (RULES Bab 19/19a/19b):

| Item | Nilai |
| --- | --- |
| `filter` whitelist | `email, fullName, status, roleId, countryId, createdAt, updatedAt` (enum `status` invalid → 422; `createdAt, updatedAt` ISO 8601, dikoersi ke `Date` via `USER_DATE_FIELDS` + `parseDateInput`, invalid → 422, `like` ditolak) |
| `search` | OR `like insensitive` ke `fullName, email` (`USER_SEARCHABLE_FIELDS`); trim, kosong/<2 char diabaikan |
| `sortBy` whitelist | `fullName, email, status, roleName, createdAt, updatedAt` (`USER_SORT_FIELDS`); `roleName` → `role.name` via `USER_SORT_MAP`; tak dikenal → 422 |
| Contoh | `GET /users?search=budi&sortBy=fullName&sortOrder=asc&filter[status]=ACTIVE` · `GET /users?filter[createdAt][gte]=2026-09-01T00:00:00Z` |

User CRUD detail:

| Method / Path | Request body/params | Response | Error |
| --- | --- | --- | --- |
| `POST /users` | body `CreateUserDto` | 201 `{ data: <user>, message }` | 422 duplikat email (`P2002`), 422 validasi, 422 `countryId` tak ada (`P2003`) |
| `GET /users` | query `?page=&limit=&search=&sortBy=&sortOrder=&filter[field]=` | 200 `{ data: [user], message }` | 422 sortBy/filter tak dikenal |
| `GET /users/:id` | path `id` | 200 `{ data: <user>, message }` | 404 tidak ditemukan |
| `PATCH /users/:id` | path `id`, body `UpdateUserDto` | 200 `{ data: <user>, message }` | 404, 422 duplikat email, 422 `countryId` tak ada, 422 validasi |
| `PATCH /users/:id/role` | path `id`, body `{ roleId }` | 200 `{ data: <user>, message }` | 404 user/role, 422 |
| `DELETE /users/:id` | path `id`, query `?cascadeContent=true\|false` | 200 `{ data: <user>, message }` | 404 tidak ditemukan, 403 self-delete |

#### Delete user + cascade konten (opsional)

`DELETE /api/v1/users/:id` default **tidak berubah**: hanya menghapus row user (FK `createdBy` di konten `onDelete: SetNull`, konten tetap ada).

Query `?cascadeContent=true` menambahkan purge konten yang user-nya terdaftar sebagai **author** (join `post_authors` / `event_authors` / `archive_authors`).

| Item | Nilai |
| --- | --- |
| Query | `cascadeContent` (opsional, boolean; string `"true"` diterima via `DeleteUserQueryDto`) |
| Konten yang dihapus | Post, Event, Archive di mana user ada di author join |
| Konten yang **tidak** dihapus | konten orang lain yang hanya `createdBy` user (FK `SetNull` dibiarkan); submission terkait tidak diutak-atik |
| Urutan | (1) resolve user → 404 bila tak ada + gerbang `admin:access`; (2) purge konten (Post → Event → Archive, per id, reuse `*.service.remove` yang mengurus gambar/dokumen/S3); (3) hapus user |
| Retryability | sequential + fail-fast: bila satu delete konten gagal, user **tidak** dihapus → request bisa diulang; bukan satu transaksi besar (storage eksternal best-effort) |
| Guard | `@Permissions('user:delete')` + `assertAdmin` (`admin:access`), sama seperti default |
| Self-delete | `DELETE /users/:id` dengan `id === userId` **ditolak 403** (`ForbiddenException: Cannot delete your own account`). Dicek SEBELUM purge konten (agar tidak ada partial purge) dan sebelum delete di `UserService.remove`. Cek existence/404 tetap lebih dulu. Hardening atas perilaku lama (sebelumnya self-delete diizinkan). |
| Bypass scope konten | Purge memanggil `post/event/archiveService.remove(id, userId, { skipScopeCheck: true })` — `assertWritable` (scope tulis konten) dilewati **hanya** untuk jalur ini. Alasannya: operasi sudah diotorisasi `user:delete` + `admin:access`; scope konten yang lebih sempit (`own`/`network`/`published`) membuat purge deterministik 403 di tengah jalan → konten terhapus separuh tanpa rollback lintas service dan retry tidak pernah konvergen. Tanpa opsi, perilaku `remove` ketiga service identik seperti sebelumnya (scope check tetap jalan). |
| Response | 200 `{ data: <user>, message }` (entitas user terhapus); 404 user tak ada; 403 self-delete; 422 `cascadeContent` bukan boolean |
| Orkestrasi | `UserContentPurgeService.remove(id, userId, cascadeContent)` (modul terpisah, bukan `UserService` — hindari dependency cycle dengan modul konten) |

Keputusan akses user (eksplisit):

| Endpoint | Akses | Catatan |
| --- | --- | --- |
| `POST /api/v1/auth/register` | PUBLIC | Create mandiri user tetap publik |
| `POST /api/v1/users` | `user:create` | Create oleh admin/tooling butuh permission |
| `GET /users*` | `user:read` | read |
| `PATCH /users/:id`, `/users/:id/role` | `user:update` | update & assign role |
| `DELETE /users/:id` | `user:delete` | delete |

### Gerbang admin (`admin:access`, permission-based)

`UserService` **tidak** memakai `AccessScopeService` (scope konten) untuk hak user/role. Gerbang eksplisit: `hasAdminAccess(codes)` — user wajib punya permission **`admin:access`** (hanya role `admin` di seed). Ini mencegah eskalasi: role custom ber-permission konten (`event:publish`, dst.) **selalu 403** di endpoint user.

| Endpoint | `admin:access` | Non-admin (termasuk `member`/`author`/role custom konten) |
| --- | --- | --- |
| `POST /users` | `roleId`/`networkId` dari body diteruskan apa adanya | 403 |
| `GET /users` | semua user | 403 |
| `GET /users/:id` | bebas | 403 |
| `PATCH /users/:id` | ✅ | 403 |
| `PATCH /users/:id/role` | ✅ | 403 |
| `DELETE /users/:id` | ✅ | 403 |

- **Dua lapis:** guard `@Permissions('user:*')` **dan** gerbang `admin:access` di service. Role bawaan non-admin (`member`/`author`) tidak punya `user:*` sama sekali, dan role custom mana pun tanpa `admin:access` tetap **403** di service.
- `UpdateUserDto` mewarisi `roleId`/`networkId` dari `CreateUserDto`, tetapi `update()` **belum** menerapkannya (hanya `email`/`fullName`/`status`/`countryId`/`password`); pindah role lewat `PATCH /users/:id/role`.
- Assign `roleId` (create/assignRole) hanya oleh pemegang `admin:access`.

```json
// 403 — non-admin (tanpa `admin:access`) mengakses endpoint user
{ "statusCode": 403, "message": "Forbidden resource", "errors": [] }
```


---

## 8. Error & Exception

| Endpoint | Exception | Status | Penyebab |
| --- | --- | --- | --- |
| register/create/update | `UnprocessableEntityException` | 422 | email duplikat (`P2002` → `{ field: 'email', message: 'email already exists' }`) |
| register | `UnprocessableEntityException` | 422 | validasi DTO (password < 8, email invalid) |
| login | `UnauthorizedException` | 401 | email tak ada / password salah |
| login | `UnprocessableEntityException` | 422 | validasi DTO |
| create/list/detail/update/remove/role | `NotFoundException` | 404 | resource tidak ada |
| remove | `ForbiddenException` | 403 | self-delete (`id === userId`) — `Cannot delete your own account` |
| create/update/profile | `UnprocessableEntityException` | 422 | `countryId` tidak ada (FK `P2003` → `{ field: 'countryId', message: 'Country not found' }`) |
| profile (`PATCH /auth/me`) | `BadRequestException` | 400 | tidak ada field yang dikirim |
| `POST /users`, `GET/PATCH/DELETE /users*` tanpa `admin:access` | `ForbiddenException` | 403 | endpoint admin-only (`admin:access`) |
| semua | `ForbiddenException` | 403 | JWT valid tapi permission kurang |
| semua | `UnauthorizedException` | 401 | JWT invalid/expired |
| semua | `UnprocessableEntityException` | 422 | validasi DTO |
| semua | `BadRequestException` | 400 | payload/query tidak dapat dipahami |

Format error standar: `{ statusCode, message, errors }` (RULES bab 5).