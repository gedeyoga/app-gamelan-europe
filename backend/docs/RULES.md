# RULES.md — Aturan Lengkap Monorepo NestJS

Dokumen ini adalah sumber aturan pengembangan backend. Struktur yang diasumsikan:

```
backend/
├── nest-cli.json
├── apps/
│   ├── app/
│   └── worker/
└── libs/
    ├── prisma/schema.prisma
    └── src/
        ├── core/
        ├── common/
        ├── integrations/
        ├── modules/
        ├── events/
        └── commands/
```

---

## Package Manager (pnpm)

- Wajib `pnpm` sebagai package manager. **Larang** `npm` / `yarn install`.
- Monorepo NestJS CLI tetap single `package.json` di root — **tidak** perlu `packages:` di `pnpm-workspace.yaml`; file boleh ada untuk `allowBuilds`.
- Lockfile `pnpm-lock.yaml` wajib di-commit; jangan pernah mix dengan `package-lock.json` / `yarn.lock`.
- Instalasi: `pnpm install`. Semua script via `pnpm`:
  - `pnpm run build` — build semua project.
  - `pnpm run start:app` — jalankan `apps/app`.
  - `pnpm run start:worker` — jalankan `apps/worker`.
  - `pnpm prisma:generate` — generate Prisma client.
- `package.json` root menyertakan field `"packageManager": "pnpm@<version>"`.
- Tambah dependency selalu pakai `pnpm add` / `pnpm add -D` (bukan `npm install <pkg>`).

### Scripts Resmi

| Script | Perintah |
| --- | --- |
| `pnpm run build` | `nest build app && nest build worker` (build kedua project). |
| `pnpm run dev` | `concurrently -n api,worker -c blue,green "pnpm dev:app" "pnpm dev:worker"` (dev kedua project paralel). |
| `pnpm dev:app` | `nest start --watch app` |
| `pnpm dev:worker` | `nest start --watch worker` |
| `pnpm build:app` | `nest build app` |
| `pnpm build:worker` | `nest build worker` |
| `pnpm start:app` | `nest start app` |
| `pnpm start:worker` | `nest start worker` |
| `pnpm prisma:generate` | `prisma generate --schema libs/prisma/schema.prisma` |

### Port

- `apps/app` (API) jalan di port **3001** (env `API_PORT`, default 3001).
- `apps/worker` jalan di port **3002** (env `WORKER_PORT`, default 3002).

---

## 1. Monorepo & Scope `libs/`

- Monorepo NestJS berjalan dalam mode CLI: `nest-cli.json` dengan `"monorepo": true`.
- Project:
  - `apps/app` — backend API utama.
  - `apps/worker` — worker API.
  - `libs/` — shared library, source di `libs/src/`.
- Path alias `@app/libs` diarahkan ke `libs/src`.
- **Larang duplikasi shared code**: semua logika bisnis & kode yang dipakai lintas service wajib ada di `libs/src`.
- **Controller TIDAK di `libs`** — controller hidup di setiap service: `apps/*/src/controllers/`.

Contoh `nest-cli.json`:

```json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "apps/app/src",
  "monorepo": true,
  "compilerOptions": {
    "webpack": false,
    "tsConfigPath": "apps/app/tsconfig.app.json"
  },
  "projects": {
    "app": {
      "type": "application",
      "root": "apps/app",
      "sourceRoot": "apps/app/src"
    },
    "worker": {
      "type": "application",
      "root": "apps/worker",
      "sourceRoot": "apps/worker/src"
    },
    "libs": {
      "type": "library",
      "root": "libs",
      "sourceRoot": "libs/src"
    }
  }
}
```

---

## 2. Folder Structure & Decision Tree

### Struktur `libs/src/`

| Folder | Isi |
| --- | --- |
| `core/` | Infrastruktur inti: database, redis, cache, config, queue. |
| `common/` | Hal lintas-potong: interceptors, filters, guards, exceptions, pipes, decorators. |
| `integrations/` | Client pihak ketiga (payment, email, eksternal API). |
| `modules/` | Modul bisnis (service, repository, dto, entities). |
| `events/` | Event emitter, listener, publisher/subscriber. |
| `commands/` | Handler perintah / CLI / job worker. |

### Decision Tree Penempatan

1. Dipakai banyak service + logika bisnis? → `modules/`.
2. Infrastruktur (DB, Redis, config)? → `core/`.
3. Lintas-potong (guard, filter, interceptor, exception)? → `common/`.
4. Klien eksternal? → `integrations/`.
5. Event-driven (emit/listen)? → `events/`.
6. Job/perintah worker? → `commands/`.
7. HTTP endpoint? → **bukan `libs`**, taruh di `apps/*/src/controllers/`.

---

## 3. Arsitektur Service-Repository

- Modul bisnis di `libs/src/modules/<domain>/`: `service`, `repository`, `dto`, `entities`.
- Controller di `apps/*/src/controllers/`.
- Alur baku:

```
Controller → Service → Repository → Prisma
```

- **Repository satu-satunya tempat query Prisma.** Service tidak menyentuh Prisma langsung.
- **Controller tipis** — hanya menerima request, delegasi ke service, kembalikan hasil. Tidak ada logika bisnis.

```typescript
// libs/src/modules/payee/payee.service.ts
@Injectable()
export class PayeeService {
  constructor(private readonly payeeRepository: PayeeRepository) {}

  async findOne(id: string) {
    return this.payeeRepository.findById(id);
  }
}
```

---

## 4. Single Source of Truth

- `libs/prisma/schema.prisma` = **satu-satunya** sumber entity/tabel.
- **Satu payload type per model** untuk hasil mapping `select` — definisikan sekali, jangan ulangi `Prisma.GetPayload` inline di banyak tempat.

```typescript
// libs/src/modules/payee/entities/payee.entity.ts
import { Prisma } from '@prisma/client';

export const payeeSelect = {
  id: true,
  name: true,
  accountNumber: true,
  status: true,
} satisfies Prisma.PayeeSelect;

export type PayeeEntity = Prisma.PayeeGetPayload<{ select: typeof payeeSelect }>;
```

- **DTO per endpoint** via `class-validator` + `class-transformer`, tanpa duplikasi antar endpoint.

```typescript
// libs/src/modules/payee/dto/create-payee.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePayeeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  accountNumber: string;
}
```

---

## 5. API Response

- Satu sumber: `ResponseInterceptor` (sukses) + `HttpExceptionFilter` (error) di `libs/src/common/`.
- **Sukses**: `{ data, message }` — `data` array untuk list, object untuk single, `null` jika kosong.
- **Pengecualian list ber-paginasi**: menambah field `meta` → `{ data, message, meta }` (lihat bab 19).
- **Error**: `{ statusCode, message, errors }` — `errors` berisi detail per-field untuk validasi 422, `[]` untuk error umum.
- Exception wajib jelas: `BadRequestException`, `NotFoundException`, `ConflictException`, `ForbiddenException`, `UnauthorizedException`, `UnprocessableEntityException` (422), dan custom di `libs/src/common/exceptions/`.
- **Larang** `throw new Error` — pengecualian: skrip CLI sekali-jalan (`libs/prisma/seed.ts`) boleh `throw new Error` + `process.exit(1)` untuk fail-fast.

```typescript
// libs/src/common/interceptors/response.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => ({ data, message: 'success' })));
  }
}
```

```typescript
// libs/src/common/filters/http-exception.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse() as any;

      // 422 → normalisasi ke kontrak { field, message } per-field (lihat bab 7).
      if (status === HttpStatus.UNPROCESSABLE_ENTITY) {
        const errors = this.normalizeValidationErrors(res); // { field: property, message }
        response.status(status).json({
          statusCode: status,
          message: 'Validation failed',
          errors,
        });
        return;
      }

      const text = typeof res === 'string' ? res : res?.message;
      const message = Array.isArray(text) ? text.map((m) => String(m)).join(', ') : (text ?? exception.message);

      response.status(status).json({
        statusCode: status,
        message,
        errors: [],
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      errors: [],
    });
  }
}
```

```typescript
// libs/src/common/exceptions/domain.exception.ts
import { HttpException, HttpStatus } from '@nestjs/common';

export class DomainException extends HttpException {
  constructor(message: string, statusCode: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(message, statusCode);
  }
}
```

---

## 6. Prisma

- Gunakan `select` kolom sesuai kebutuhan — jangan tarik seluruh kolom.
- Multi-tabel pakai transaksi `$transaction`.
- Map error Prisma (P2002 → `ConflictException`, dst) ke Exception domain — jangan bocorkan error mentah.

```typescript
// libs/src/modules/payee/payee.repository.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { payeeSelect, PayeeEntity } from './entities/payee.entity';
import { Prisma } from '@prisma/client';

@Injectable()
export class PayeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<PayeeEntity> {
    const payee = await this.prisma.payee.findUnique({ where: { id }, select: payeeSelect });
    if (!payee) throw new NotFoundException('Payee not found');
    return payee;
  }

  async create(data: Prisma.PayeeCreateInput): Promise<PayeeEntity> {
    try {
      return await this.prisma.payee.create({ data, select: payeeSelect });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Payee already exists');
      }
      throw e;
    }
  }
}
```

---

## 7. Validasi

- Global `ValidationPipe` wajib di **app + worker** (`apps/app/src/main.ts` dan `apps/worker/src/main.ts`) dengan `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- Status validasi gagal = **422** (`errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY`).
- **Kontrak 422**: `{ statusCode: 422, message: 'Validation failed', errors: [{ field, message }] }` — `field` = `property` class-validator (path nested/array dipertahankan, mis. `permissionIds.0`), `message` = pesan constraint. FE me-mirror ke `form.setError` per-field (jangan toast).
- **DTO strict (wajib mirror FE-BE)**: semua field string pakai `@Transform(({ value }) => trim bila string)` + `@MaxLength(...)` sesuai kolom; id referensi pakai `@IsUUID()`; array id pakai `@IsUUID(..., { each: true })` + `@ArrayMinSize(...)`; `ParseUUIDPipe` di semua `@Param('id')` controllers.
- `HttpExceptionFilter` wajib mapping 422 ke `{ field: property, message }` (flatten `constraints` + `children`; string `forbidNonWhitelisted` → parse `property <nama>`).
- Modul baru wajib: tabel validasi per-field + contoh 422 di `docs/modules/<nama>.md`.

```typescript
// apps/app/src/main.ts (mirror identik di apps/worker/src/main.ts)
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  }),
);
```

```typescript
// contoh DTO strict
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateUserRoleDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsUUID()
  @IsNotEmpty()
  roleId: string;
}
```

```typescript
// contoh ParseUUIDPipe di controller
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) {
  return this.userService.findOne(id);
}
```

```json
// contoh 422
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "email must be an email" }]
}
```

---

## 8. Config & Secret

- Gunakan `@nestjs/config` + `.env`.
- Wajib validasi env (mis. `Joi` atau `class-validator`).
- **Larang** `process.env` tersebar di seluruh kode.
- Secret tidak di-commit & tidak di-log.

---

## 9. Logging

- Gunakan `Logger` NestJS.
- **Larang** `console.log` — pengecualian: skrip CLI sekali-jalan (`libs/prisma/seed.ts`) boleh `console.*` untuk log progres seed.
- Jangan log password, token, atau secret.

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PayeeService {
  private readonly logger = new Logger(PayeeService.name);

  async findOne(id: string) {
    this.logger.log(`Fetching payee ${id}`);
    // ...
  }
}
```

---

## 10. Async

- Semua method gunakan `async/await`.
- **Larang** `.then` berantai & blocking I/O.

---

## 11. Dependency Injection

- Injection via constructor dengan `@Injectable`.
- **Larang** `new` untuk instansiasi dependency.

---

## 12. Versioning

- Global prefix `/api/v1`.
- `GET /api/v1/health` → `{ data: { status: 'ok' }, message: '...' }`.

```typescript
// apps/app/src/main.ts
app.setGlobalPrefix('api/v1');
```

```typescript
// apps/app/src/controllers/health.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok' };
  }
}
```

---

## 13. HTTP Status

| Kode | Makna |
| --- | --- |
| 200 | OK (read/update/list). |
| 201 | Created (create). |
| 400 | Bad Request. |
| 401 | Unauthorized. |
| 403 | Forbidden. |
| 404 | Not Found. |
| 409 | Conflict. |
| 422 | Unprocessable Entity (validasi). |
| 500 | Internal Server Error. |

---

## 14. Naming

- Folder domain **singular**: `payee/`, `account/`.
- Folder reusable **plural**: `pipes/`, `utils/`.
- File:
  - Service: `[name].service.ts`
  - Module: `[name].module.ts`
  - DTO: `[action]-[entity].dto.ts`
  - Client: `[provider]-[entity].client.ts`
  - Guard: `[name].guard.ts`
- Class: `PascalCase`.
- Method: `camelCase`.
- Konstanta: `UPPER_SNAKE_CASE`.

---

## 15. Testing

- Unit test berdampingan: `*.spec.ts`.
- e2e test di `test/`.
- Verifikasi format response & mapping exception.

---

## 16. Konvensi Umum

- TypeScript `strict: true`.
- **Larang** `any` di boundary (input/output API).
- **Larang** `@ts-ignore` tanpa alasan jelas.

---

## 17. Redis Caching

- Client di `core/redis` dibungkus `cache.service.ts`.
- **TTL wajib eksplisit.**
- Key prefix per domain.
- Invalidate cache saat mutasi data.
- Alur: cache miss → Prisma `select` → simpan → return.
- **Larang** cache data sensitif.
- Error Redis → fallback ke DB, jangan lempar ke client.

```typescript
// libs/src/core/redis/cache.service.ts
import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (e) {
      this.logger.warn(`Redis get failed: ${key}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (e) {
      this.logger.warn(`Redis set failed: ${key}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (e) {
      this.logger.warn(`Redis del failed: ${key}`);
    }
  }
}
```

```typescript
// contoh pemakaian di service
@Injectable()
export class PayeeService {
  private readonly keyPrefix = 'payee';

  constructor(
    private readonly payeeRepository: PayeeRepository,
    private readonly cache: CacheService,
  ) {}

  async findOne(id: string): Promise<PayeeEntity> {
    const key = `${this.keyPrefix}:${id}`;
    const cached = await this.cache.get<PayeeEntity>(key);
    if (cached) return cached;

    const payee = await this.payeeRepository.findById(id);
    await this.cache.set(key, payee, 300);
    return payee;
  }
}
```

---

## 18. Inter-Service Auth (api ↔ worker)

- Shared secret via env (mis. `INTERNAL_API_SECRET`).
- **Larang** hardcode, commit, atau log secret.
- Guard `InternalAuthGuard` di `libs/src/common/guards/` memvalidasi header (mis. `x-internal-secret`).
- Endpoint internal diproteksi guard; endpoint publik **tidak** memakai secret ini.
- Secret hanya dibaca dari config service + validasi env, dirotasi lewat env.
- Respons gagal validasi = **401**.

```typescript
// libs/src/common/guards/internal-auth.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = request.headers['x-internal-secret'];
    const expected = this.config.get<string>('INTERNAL_API_SECRET');

    if (!secret || secret !== expected) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    return true;
  }
}
```

```typescript
// penggunaan di controller worker
@Controller('internal/jobs')
@UseGuards(InternalAuthGuard)
export class InternalJobsController {
  // ...
}
```

---

## 19. List API (Pagination & Filter)

Semua list endpoint **wajib pagination** dan memakai kontrak filter yang **seragam** lintas seluruh endpoint.

### Kontrak Query Param

| Param | Default | Aturan |
| --- | --- | --- |
| `page` | `1` | `@Min(1)`, tanpa batas atas (bebas). |
| `limit` | `20` | `@Min(1)`, maksimal `100`; nilai `>100` → **clamp ke 100** (tidak error). |
| `sortBy` | `createdAt` | **Wajib whitelist = semua kolom yang ditampilkan di menu CRUD FE** (lihat 19b). |
| `sortOrder` | `desc` | Enum `asc` / `desc`. |
| `search` | — | Global search bar semua menu CRUD (lihat 19a). |
| `filter[field]=value` | — | Filter generik; field di-whitelist per endpoint. |

### Filter Seragam (`filter[field]`)

- Bentuk dasar: `filter[field]=value` → equality (`eq`).
- Operator eksplisit: `filter[field][op]=value`.
- Operator yang diizinkan:

| Operator | Makna |
| --- | --- |
| `eq` | sama dengan (default) |
| `ne` | tidak sama |
| `in` | salah satu dari daftar (comma-separated: `a,b,c`) |
| `like` | partial match (case-insensitive) |
| `gt` / `gte` | lebih besar (sama dengan) |
| `lt` / `lte` | lebih kecil (sama dengan) |

- Nilai `in` dipecah berdasarkan koma; tipe lain di-parse sesuai tipe kolom (number/bool/enum/date).

### Aturan Wajib

- **Whitelist filter & sort**: `filter[field]` dan `sortBy` hanya boleh kolom yang didaftarkan per endpoint (cegah injeksi kolom arbitrer). Field/operator/kolom tak dikenal → **422** `UnprocessableEntityException`.
- **Enum filter** nilai tidak valid → **422** (`@IsEnum`).
- `sortBy` tidak boleh kolom sensitif (mis. `passwordHash`).
- `filter[field]` value kosong (`filter[status]=`) → diabaikan, bukan error.

### Response

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 0 },
  "message": "success"
}
```

- `data`: array item.
- `meta`: `page`, `limit`, `total` (total item keseluruhan, bukan total halaman).

### Implementasi

- **DTO shared**: `libs/src/common/dto/list-query.dto.ts` — base `page`, `limit`, `sortBy`, `sortOrder`, `filter`. Per-endpoint `extend` untuk whitelist `allowedFilterFields` / `allowedSortBy`.

```typescript
// libs/src/common/dto/list-query.dto.ts
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export type SortOrder = 'asc' | 'desc';

export class ListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 20;

  @IsOptional() @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional() @IsEnum(['asc', 'desc'])
  sortOrder?: SortOrder = 'desc';
}
```

- **Clamp limit**: `const limit = Math.min(query.limit ?? 20, 100)`.
- **Repository**: `skip = (page - 1) * limit`, `take = limit`; query `count` terpisah untuk `total`. Mapping `filter` → Prisma `where`, `sortBy/sortOrder` → `orderBy`.

```typescript
// contoh di repository
async findMany(query: ListQueryDto) {
  const { page = 1, limit, filter, sortBy, sortOrder } = query;
  const take = Math.min(limit, 100);
  const skip = (page - 1) * take;

  const [items, total] = await this.prisma.$transaction([
    this.prisma.payee.findMany({ where: buildWhere(filter), orderBy: { [sortBy]: sortOrder }, skip, take, select: payeeSelect }),
    this.prisma.payee.count({ where: buildWhere(filter) }),
  ]);

  return { items, total };
}
```

- **`ResponseInterceptor`** wajib melewatkan `meta` (lihat bab 5) — hasil service `{ items, total }` dibungkus `{ data: items, meta: { page, limit, total }, message }`. Non-list tetap `{ data, message }`.

### Contoh Pemakaian Query

- `GET /api/v1/users?page=2&limit=50&sortBy=createdAt&sortOrder=desc&filter[status]=ACTIVE`
- `GET /api/v1/users?filter[email][like]=@company.com&filter[roleId][in]=r_a,r_b`
- `GET /api/v1/users?search=budi&sortBy=fullName&sortOrder=asc`
- `GET /api/v1/roles?search=admin&sortBy=name&sortOrder=asc`

### 19a. Search Bar Global (wajib semua menu CRUD list)

Setiap menu CRUD list **wajib** mendukung satu search bar global (server-side):

- Param: `search=<string>` opsional di `ListQueryDto` (`@IsString() @MaxLength(100)`).
- Semantik: `search` di-trim; kosong / `<2 char` → **diabaikan, bukan error** (FE bebas kirim hasil debounce).
- `>100 char` → **422**.
- Mapping: `OR` dari `like` (`contains`, `mode: 'insensitive'`) ke daftar `*_SEARCHABLE_FIELDS` per modul:
  - User: `['fullName', 'email']`.
  - Role: `['name', 'description']`.
  - Permission: `['code', 'description']`.
- Kombinasi: `search` di-`AND`-kan dengan `filter[field]` bila keduanya dikirim (`combineWhere`).
- Implementasi: helper `buildSearch(search, searchableFields)` + `combineWhere(filterWhere, searchWhere)` di `libs/src/common/utils/list-filter.util.ts`. Service tidak merakit `OR` manual.
- Modul baru wajib deklarasikan `*_SEARCHABLE_FIELDS` = subset kolom teks yang ditampilkan di tabelnya, dan catat di `docs/modules/<nama>.md`.

```typescript
const filterWhere = buildWhere(query.filter, USER_FILTER_FIELDS, { enumFields: {...} });
const searchWhere = buildSearch(query.search, USER_SEARCHABLE_FIELDS);
const where = combineWhere(filterWhere, searchWhere);
```

### 19b. Order-By Semua Kolom Tampil (wajib semua menu CRUD list)

Setiap kolom yang ditampilkan di tabel menu CRUD **wajib sortable** (klik header → `asc/desc`, server-side):

- `sortBy` whitelist per modul = **semua kolom tampil**, bukan hanya `createdAt/updatedAt`:
  - User: `['fullName', 'email', 'status', 'roleName', 'createdAt', 'updatedAt']`.
  - Role: `['name', 'description', 'createdAt', 'updatedAt']`.
  - Permission: `['code', 'description', 'createdAt', 'updatedAt']`.
- Kolom sensitif (`passwordHash`, token) **dilarang** masuk whitelist; `sortBy` tak dikenal → **422** via `assertAllowedSort`.
- Kolom relasi (mis. `roleName` tampil dari `role.name`) wajib deklarasikan `*_SORT_MAP`, mis. `USER_SORT_MAP = { roleName: 'role.name' }`, dan gunakan helper `buildOrderBy(sortBy, sortOrder, mapSort)` yang memetakan ke `orderBy` nested Prisma (`{ role: { name: order } }`).
- Bila kolom relasi tidak bisa di-sort efisien, modul boleh menandai `sortable: false` **hanya** dengan alasan tertulis di `docs/modules/<nama>.md` + fallback sort kolom FK-nya. Tanpa catatan = wajib sortable.
- Default tetap `sortBy=createdAt, sortOrder=desc` bila FE tidak mengirim sort (klik header ketiga = kembali ke default).
- Modul baru wajib: daftar `*_SORT_FIELDS` + `*_SORT_MAP` (bila ada relasi) + contoh `?sortBy=<kolom>&sortOrder=asc` di brief modulnya.

---

## 20. Penanganan Waktu (UTC)

Semua waktu disimpan, dikirim, dan diterima dalam UTC. Tidak ada wall-clock lokal di DB maupun API.

### Simpan: Prisma `DateTime` (timestamptz UTC)

- Semua kolom waktu Prisma wajib `DateTime` (→ `timestamptz` UTC).
- Pola baku: `createdAt @default(now())`, `updatedAt @updatedAt`.
- Larang menyimpan wall-clock lokal / string tanpa offset.

```prisma
model User {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
}
```

### Tulis: tanggal server-generated selalu UTC

- Tanggal server-generated (`now()`, `@updatedAt`, `new Date()`, `Date.now()`) selalu UTC.
- Larang `new Date(y, m, d)`, parse ulang `toLocaleString`, aritmetika string lokal.

```typescript
// benar: bandingkan langsung dalam UTC
if (stored.expiresAt <= new Date()) {
  throw new UnauthorizedException('Token expired');
}

// benar: hitung expiry dari epoch
const expiresAt = new Date(Date.now() + expiresIn * 1000);
```

### Baca/kirim: serialisasi ISO 8601 UTC

- API selalu serialisasi `Date` sebagai ISO 8601 UTC dengan `Z` (default JSON `toISOString()`).
- Larang override format lokal di response.

```typescript
// otomatis: JSON.stringify({ createdAt: new Date() })
// → { "createdAt": "2026-09-05T00:00:00.000Z" }
```

### Terima: input tanggal client wajib ISO 8601

- Input tanggal client wajib ISO 8601 (`@IsISO8601()` atau `@Type(() => Date) @IsDate()` dengan global `transform: true`).
- Format lokal ambigu → **422**.
- Normalisasi eksplisit bila perlu: `new Date(value).toISOString()` sebelum ke Prisma.

```typescript
import { IsISO8601 } from 'class-validator';

export class FilterByDateDto {
  @IsISO8601()
  from: string;
}
```

### Filter tanggal: `filter[field][op]` dikoersi ke `Date`

- `filter[field][gt/gte/lt/lte/eq]` untuk field di `*_DATE_FIELDS` dikoersi ke `Date` (`parseDateInput` di `libs/src/common/utils/list-filter.util.ts`).
- Nilai invalid → **422** `UnprocessableEntityException`; `like` ditolak untuk field tanggal.
- Contoh: `GET /users?filter[createdAt][gte]=2026-09-01T00:00:00Z`.

```typescript
export const USER_DATE_FIELDS = ['createdAt', 'updatedAt'];

const where = buildWhere(query.filter, USER_FILTER_FIELDS, {
  dateFields: USER_DATE_FIELDS,
});
```

---

## 21. Authorization (JWT + Permissions, Deny-by-Default)

Aturan otorisasi baku seluruh endpoint `apps/app`. Detail implementasi & tabel endpoint ada di `docs/modules/rbac.md §6` dan `§8`. Bab ini hanya berlaku untuk `apps/app`; `apps/worker` tidak memakai `APP_GUARD` global JWT/permissions — `InternalJobsController` diproteksi `InternalAuthGuard` (bab 18).

### 21a. Prinsip: JWT → 401 vs Permission → 403

| Lapisan | Guard | Gagal → |
| --- | --- | --- |
| Autentikasi | `JwtAuthGuard` (global `APP_GUARD`, pertama) | **401** `UnauthorizedException` — JWT tidak ada / invalid / expired / blacklisted. `@Public()` mem-bypass guard ini. |
| Otorisasi | `PermissionsGuard` (global `APP_GUARD`, kedua) | **403** `ForbiddenException` — JWT valid tapi `permission.code` kurang. Tanpa metadata + tanpa user → **403** + `Logger.warn` (bug: dekorator lupa). Tanpa `user.id` saat metadata ada → **401**. |

- **401 selalu didahulukan** sebelum 403 (`JwtAuthGuard` global tetap 401 dulu).
- `PermissionsGuard` tidak pernah percaya klaim JWT — daftar `permission.code` selalu di-load **fresh dari DB** tiap request via `PermissionService.getPermissionCodesByUserId(user.id)` (single source of truth, rbac.md §6).
- `Logger.warn` pada guard tanpa metadata adalah sinyal review — bukan alur normal.

### 21b. Konvensi `resource:action` (lowercase)

- Format: **lowercase** `resource:action`, `:` pemisah. `resource` = domain tunggal, `action` ∈ `create | read | update | delete`.
- Resource baku RBAC:

| Resource | Action | Code |
| --- | --- | --- |
| user | create / read / update / delete | `user:create`, `user:read`, `user:update`, `user:delete` |
| role | create / read / update / delete | `role:create`, `role:read`, `role:update`, `role:delete` |
| permission | create / read / update / delete | `permission:create`, `permission:read`, `permission:update`, `permission:delete` |

- Resource baru (mis. `payment`, `order`) mengikuti pola yang sama.
- Validasi format di DTO: `@Matches(/^[a-z]+:[a-z]+$/)` (lihat `docs/modules/permission.md §4`).

### 21c. Aturan wajib: setiap endpoint punya salah satu

Setiap endpoint **wajib** tepat satu dari tiga status berikut:

1. `@Public()` — terbuka tanpa JWT.
2. `@Permissions(...)` — butuh JWT + permission code yang cocok.
3. **LOGIN-only** (tanpa dekorator + ada `request.user` terautentikasi) — **hanya** `POST /api/v1/auth/logout` dan `GET /api/v1/auth/me`.

Tanpa ketiganya (tanpa metadata + tanpa user) → **403** `ForbiddenException('Permission required')` + `Logger.warn` → **dianggap bug** (dekorator lupa dipasang), wajib diperbaiki bukan diandalkan.

```typescript
// contoh: endpoint admin butuh permission
import { Controller, Post, Body } from '@nestjs/common';
import { Permissions } from '@app/libs';

@Controller('users')
export class UsersController {
  @Post()
  @Permissions('user:create')
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }
}
```

```typescript
// contoh: endpoint publik
import { Controller, Get } from '@nestjs/common';
import { Public } from '@app/libs';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health() {
    return { status: 'ok' };
  }
}
```

### 21d. Daftar pengecualian resmi

**PUBLIC** (`@Public()`, lolos kedua guard):

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/api/v1/health` | Health check. |
| POST | `/api/v1/auth/register` | Registrasi mandiri. |
| POST | `/api/v1/auth/login` | Login, terbit JWT. |
| POST | `/api/v1/auth/refresh` | Rotasi refresh token (body `refreshToken`). |
| GET | `/api/v1/regions` | Data referensi region untuk dropdown pra-login. |
| GET | `/api/v1/countries` | Data referensi negara untuk dropdown pra-login. |
| GET | `/api/v1/countries/:id` | Detail negara (referensi). |
| GET | `/api/v1/states` | Data referensi state/provinsi untuk dropdown pra-login. |
| GET | `/api/v1/states/:id` | Detail state (referensi). |

**LOGIN-only** (tanpa dekorator, lolos karena ada `request.user` dari `JwtAuthGuard`):

| Method | Path | Keterangan |
| --- | --- | --- |
| POST | `/api/v1/auth/logout` | Blacklist access + revoke refresh. |
| GET | `/api/v1/auth/me` | Profil user + role + permissions fresh dari DB. |

Selain tabel di atas, **semua** endpoint `users` / `roles` / `permissions` (termasuk `GET /roles/:id/permissions` → `permission:read` dan `PUT /roles/:id/permissions` → `permission:update`) **wajib** `@Permissions(...)`. Larang menambahkan pengecualian baru tanpa mencatatkannya di sini + rbac.md §8.

### 21e. Guard deny-by-default (acuan implementasi)

Urutan cek di `PermissionsGuard.canActivate` (lihat `libs/src/core/auth/guards/permissions.guard.ts`):

```typescript
async canActivate(context: ExecutionContext): Promise<boolean> {
  // 1. PUBLIC → lolos penuh (health, auth/register/login/refresh).
  const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  if (isPublic) return true;

  // 2. Ambil metadata permission endpoint.
  const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);

  const { user } = context.switchToHttp().getRequest();

  // 3. Deny-by-default: tanpa metadata = dekorator lupa.
  //    Ada user → LOGIN-only (hanya logout/me yang sah).
  //    Tanpa user → 403 + warn (bug).
  if (!required || required.length === 0) {
    this.logger.warn(
      `Missing @Permissions metadata on ${context.getClass().name}.${context.getHandler().name} — Permission required`,
    );
    if (!user?.id) throw new ForbiddenException('Permission required');
    return true;
  }

  // 4. Metadata ada tapi tanpa user → 401 (seharusnya sudah dicegat JwtAuthGuard).
  if (!user?.id) throw new UnauthorizedException('Unauthorized');

  // 5. Load fresh dari DB, cocokkan minimal satu code.
  const codes = await this.permissionService.getPermissionCodesByUserId(user.id);
  const allowed = required.some((code) => codes.includes(code));
  if (!allowed) throw new ForbiddenException('Forbidden resource');
  return true;
}
```

### 21f. Modul baru wajib deklarasikan permission

- Tentukan `resource` baru (lowercase, singular) + butuh `action` apa saja (`create/read/update/delete` atau subset yang relevan).
- Daftarkan `code` di `DEFAULT_PERMISSIONS` pada `libs/prisma/seed.ts` lalu jalankan `pnpm prisma:seed` (`POST /permissions` hanya untuk data non-default/insidental).
- Setiap endpoint modul baru **wajib** pasang `@Permissions('<resource>:<action>')` — contoh:

```typescript
@Post()
@Permissions('order:create')
create(@Body() dto: CreateOrderDto) {
  return this.orderService.create(dto);
}

@Get()
@Permissions('order:read')
findAll(@Query() query: ListQueryDto) {
  return this.orderService.findMany(query);
}
```

- Catat `*_FILTER_FIELDS` / `*_SEARCHABLE_FIELDS` / `*_SORT_FIELDS` modul baru (bab 19) **dan** tabel permission endpoint-nya di `docs/modules/<nama>.md` + baris ringkas di `rbac.md §8`.
- Endpoint tanpa ketiganya (§21c) → 403 + bug — jangan rilis.

### 21g. Kombinasi `InternalAuthGuard` bila perlu

- Komunikasi antar-service (api ↔ worker) memakai `InternalAuthGuard` (bab 18, header `x-internal-secret`) — **terpisah** dari JWT/permissions user.
- Endpoint internal (`@Controller('internal/...')` di worker) diproteksi `@UseGuards(InternalAuthGuard)` dan **tidak** memakai `@Permissions(...)`.
- Bila satu controller butuh keduanya (jarang), pasang eksplisit `@UseGuards(InternalAuthGuard)` + `@Permissions(...)` dan catat di docs modulnya — guard global JWT/permissions tetap berjalan, `InternalAuthGuard` menambah syarat secret.

---

## 22. Compression

Semua API response di-compress menggunakan **gzip** via Express `compression` middleware.

| Aspek | Nilai |
| --- | --- |
| Level | Transport |
| Implementation | `compression()` middleware (otomatis pilih gzip/deflate/br) |
| Placement | `main.ts` baris pertama setelah `NestFactory.create` |
| Benefit | Payload lebih kecil, transfer lebih cepat |

```typescript
// apps/app/src/main.ts
import compression from 'compression';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(compression());
  // ...
}
```

---

## 23. Seeding RBAC (Upsert)

Lokasi tunggal: `libs/prisma/seed.ts` — berisi `DEFAULT_PERMISSIONS` (array `{ code, description }`), `DEFAULT_ROLES` (array `{ name, description, permissions: string[] }`, saat ini `admin`/`organization`/`member` — lihat [rbac.md §7](./modules/rbac.md#7-seed-default)), dan user admin dari env `ADMIN_EMAIL` / `ADMIN_FULL_NAME` / `ADMIN_PASSWORD` (role `admin`, status `ACTIVE`).

Aturan wajib:

- **Upsert by unique key dalam satu `$transaction`**: `permission.upsert(where: { code })`, `role.upsert(where: { name })`, `rolePermission.upsert(where: { roleId_permissionId: { roleId, permissionId } })`, `user.upsert(where: { email })`. Seluruh loop seed berjalan dalam satu `prisma.$transaction` (id UUID sudah default di schema).
- **Larang `create` polos / `createMany` tanpa update `description`** — `description` wajib ter-update tiap re-seed via field `update` pada `upsert` (seed 2x tidak boleh `P2002` dan deskripsi ikut terkoreksi).
- **Additive**: relasi role → permission hanya ditambah yang kurang via `upsert`; **larang menghapus relasi via seeder** (`deleteMany` pada `rolePermission` dilarang).
- **Secret dari env + argon2id + reset tiap re-seed**: password admin selalu di-re-hash (`@node-rs/argon2`, `algorithm: 2`, `memoryCost: 65536`, `timeCost: 3`, `parallelism: 4`) dari `ADMIN_PASSWORD` dan di-update via `user.upsert` (`update: { fullName, passwordHash, roleId }`). Fail-fast (`console.error` + `process.exit(1)`) bila `ADMIN_*` kosong; jangan commit secret dan jangan log password/hash.
- Cara tambah resource baru: tambah `code` lowercase `resource:action` di `DEFAULT_PERMISSIONS` + cantumkan ke `permissions` role yang relevan di `DEFAULT_ROLES` + jalankan `pnpm prisma:seed` + catat di `rbac.md §4` / `§7` / `§8`.
