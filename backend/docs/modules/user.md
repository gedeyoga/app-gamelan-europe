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
├── user.controller.ts   ← tidak di libs; pindah ke apps/*/src/controllers/ (RULES bab 3)
├── user.module.ts
├── dto/
│   ├── register-user.dto.ts
│   ├── login.dto.ts
│   ├── create-user.dto.ts
│   ├── update-user.dto.ts
│   └── update-user-role.dto.ts
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

enum UserStatus {
  ACTIVE
  INACTIVE
  BLOCKED
}
```

- `email` unik (constraint DB) → `P2002` dipetakan ke `ConflictException` (RULES bab 6).
- `roleId` nullable: user boleh belum punya role (didapat setelah di-assign).

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
  role: true,
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
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
```

```typescript
// libs/src/modules/user/dto/update-user.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { RegisterUserDto } from './register-user.dto';

// UpdateUserDto = RegisterUserDto dengan semua field opsional;
// password di sini sudah di-hash di service, bukan dikirim sebagai password polos.
export class UpdateUserDto extends PartialType(RegisterUserDto) {}
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

> `UpdateUserDto` memperluas `RegisterUserDto` (PartialType) sehingga `email` & `fullName` tetap tervalidasi bila dikirim. `password` pada update di-eksekusi via jalur khusus (hash di service), bukan lewat `UpdateUserDto`.

### Tabel validasi & contoh 422

| Field | Aturan | Gagal → |
| --- | --- | --- |
| `email` | trim, `@IsEmail()`, `@MaxLength(255)` | 422 `{ field: 'email', message }` |
| `fullName` | trim, `@IsString()`, `@MaxLength(100)` | 422 `{ field: 'fullName', message }` |
| `password` | trim, `@MinLength(8)`, `@MaxLength(128)` | 422 `{ field: 'password', message }` |
| `roleId` (assign) | trim, `@IsUUID()` | 422 `{ field: 'roleId', message }` |
| `:id` path | `ParseUUIDPipe` | 422/400 UUID invalid |

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
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
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

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.prisma.user.findUnique({ where: { email }, select: userSelect });
  }

  async findAll(params: { skip: number; take: number }): Promise<UserEntity[]> {
    return this.prisma.user.findMany({ ...params, select: userSelect });
  }

  async create(data: Prisma.UserCreateInput): Promise<UserEntity> {
    try {
      return await this.prisma.user.create({ data, select: userSelect });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('User already exists');
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
        throw new ConflictException('User already exists');
      }
      throw e;
    }
  }

  async delete(id: string): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    return this.prisma.user.delete({ where: { id }, select: userSelect });
  }

  async updateRole(id: string, roleId: string | null): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    return this.prisma.user.update({ where: { id }, data: { roleId }, select: userSelect });
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
| GET | `/api/v1/auth/me` | Profil user aktif + role + permissions | LOGIN |

> Detail mekanisme auth (skema token, refresh rotation, logout Redis, guard, error) → **[`auth.md`](./auth.md)**.
> Response `/auth/me` → `{ data: { id, email, fullName, status, role, permissions }, message }` — `permissions` = array `permission.code` milik user.

Auth (register):

| Item | Nilai |
| --- | --- |
| Request body | `{ email, fullName, password }` (RegisterUserDto) |
| Response 201 | `{ data: <user tanpa password_hash>, message: 'success' }` |
| Validasi | `email` valid, `fullName` string non-empty, `password` min 8 → gagal = 422 |
| Error 409 | email sudah dipakai (`ConflictException`) |
| Error 422 | validasi DTO |

Auth (login):

| Item | Nilai |
| --- | --- |
| Request body | `{ email, password }` (LoginDto) |
| Response 200 | `{ data: { accessToken, refreshToken, user }, message: 'success' }` |
| Error 401 | email tak ada / password salah (`UnauthorizedException`) |
| Error 422 | validasi DTO |

### User CRUD

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| POST | `/api/v1/users` | Buat user oleh admin | PERMISSION: `user:create` |
| GET | `/api/v1/users` | List user (pagination + search + sort semua kolom tampil) | PERMISSION: `user:read` |
| GET | `/api/v1/users/:id` | Detail user | PERMISSION: `user:read` |
| PATCH | `/api/v1/users/:id` | Update user (email/fullName/status) | PERMISSION: `user:update` |
| PATCH | `/api/v1/users/:id/role` | Set role user | PERMISSION: `user:update` |
| DELETE | `/api/v1/users/:id` | Hapus user | PERMISSION: `user:delete` |

Kontrak list (RULES Bab 19/19a/19b):

| Item | Nilai |
| --- | --- |
| `filter` whitelist | `email, fullName, status, roleId, createdAt, updatedAt` (enum `status` invalid → 422; `createdAt, updatedAt` ISO 8601, dikoersi ke `Date` via `USER_DATE_FIELDS` + `parseDateInput`, invalid → 422, `like` ditolak) |
| `search` | OR `like insensitive` ke `fullName, email` (`USER_SEARCHABLE_FIELDS`); trim, kosong/<2 char diabaikan |
| `sortBy` whitelist | `fullName, email, status, roleName, createdAt, updatedAt` (`USER_SORT_FIELDS`); `roleName` → `role.name` via `USER_SORT_MAP`; tak dikenal → 422 |
| Contoh | `GET /users?search=budi&sortBy=fullName&sortOrder=asc&filter[status]=ACTIVE` · `GET /users?filter[createdAt][gte]=2026-09-01T00:00:00Z` |

User CRUD detail:

| Method / Path | Request body/params | Response | Error |
| --- | --- | --- | --- |
| `POST /users` | body `CreateUserDto` | 201 `{ data: <user>, message }` | 409 duplikat email, 422 validasi |
| `GET /users` | query `?page=&limit=&search=&sortBy=&sortOrder=&filter[field]=` | 200 `{ data: [user], message }` | 422 sortBy/filter tak dikenal |
| `GET /users/:id` | path `id` | 200 `{ data: <user>, message }` | 404 tidak ditemukan |
| `PATCH /users/:id` | path `id`, body `UpdateUserDto` | 200 `{ data: <user>, message }` | 404, 409 duplikat, 422 |
| `PATCH /users/:id/role` | path `id`, body `{ roleId }` | 200 `{ data: <user>, message }` | 404 user/role, 422 |
| `DELETE /users/:id` | path `id` | 200 `{ data: <user>, message }` | 404 |

Keputusan akses user (eksplisit):

| Endpoint | Akses | Catatan |
| --- | --- | --- |
| `POST /api/v1/auth/register` | PUBLIC | Create mandiri user tetap publik |
| `POST /api/v1/users` | `user:create` | Create oleh admin/tooling butuh permission |
| `GET /users*` | `user:read` | read |
| `PATCH /users/:id`, `/users/:id/role` | `user:update` | update & assign role |
| `DELETE /users/:id` | `user:delete` | delete |

---

## 8. Error & Exception

| Endpoint | Exception | Status | Penyebab |
| --- | --- | --- | --- |
| register | `ConflictException` | 409 | email duplikat (P2002) |
| register | `UnprocessableEntityException` | 422 | validasi DTO (password < 8, email invalid) |
| login | `UnauthorizedException` | 401 | email tak ada / password salah |
| login | `UnprocessableEntityException` | 422 | validasi DTO |
| create/list/detail/update/delete/role | `NotFoundException` | 404 | resource tidak ada |
| create/update | `ConflictException` | 409 | email duplikat |
| semua | `ForbiddenException` | 403 | JWT valid tapi permission kurang |
| semua | `UnauthorizedException` | 401 | JWT invalid/expired |
| semua | `UnprocessableEntityException` | 422 | validasi DTO |
| semua | `BadRequestException` | 400 | payload/query tidak dapat dipahami |

Format error standar: `{ statusCode, message, errors }` (RULES bab 5).