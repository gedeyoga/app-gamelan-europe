import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
// `MulterOptions` tidak di-re-export dari root `@nestjs/platform-express` (hanya type).
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { catchError, from, Observable, switchMap } from 'rxjs';

export const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];

/** Batas jumlah file per request untuk endpoint upload gambar publik (field `files`). */
export const MAX_UPLOAD_FILES = 10;

export const DEFAULT_UPLOAD_MAX_SIZE_MB = 5;

/** Bagian `ConfigService` yang dipakai helper — agar bisa di-check tanpa DI. */
export interface UploadConfigLike {
  get(key: string): unknown;
}

export const resolveUploadMaxSizeMb = (config: UploadConfigLike): number =>
  Number(config.get('UPLOAD_MAX_SIZE_MB') ?? DEFAULT_UPLOAD_MAX_SIZE_MB);

export const resolveUploadMaxBytes = (config: UploadConfigLike): number =>
  resolveUploadMaxSizeMb(config) * 1024 * 1024;

// Satu filter MIME dipakai upload single (`file`) maupun multi (`files`) — jangan duplikasi.
export const imageMimeFilter =
  (field: string): NonNullable<MulterOptions['fileFilter']> =>
  (_req, file, callback) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(
      new UnprocessableEntityException({
        message: 'Validation failed',
        errors: [{ field, message: `${field} must be one of: ${ALLOWED_MIME.join(', ')}` }],
      }),
      false,
    );
  };

// Opsi multer bersama: single source untuk mime allowlist + size cap.
export const buildImageUploadOptions = (
  config: UploadConfigLike,
  field: string,
  maxFiles: number,
): MulterOptions => ({
  limits: { files: maxFiles, fileSize: resolveUploadMaxBytes(config) },
  fileFilter: imageMimeFilter(field),
});

const validationError = (field: string, message: string): UnprocessableEntityException =>
  new UnprocessableEntityException({ message: 'Validation failed', errors: [{ field, message }] });

// Nest memetakan `LIMIT_FILE_COUNT` → `BadRequestException('LIMIT_FILE_COUNT - files')`
// sehingga `code` hilang; deteksi lewat `code` (multer mentah) ATAU message.
export const isLimitFileCountError = (error: unknown): boolean => {
  const e = error as { code?: unknown; message?: unknown } | null | undefined;
  return (
    e?.code === 'LIMIT_FILE_COUNT' ||
    (typeof e?.message === 'string' && e.message.includes('LIMIT_FILE_COUNT'))
  );
};

// Klien legacy mengirim field `file` (bukan `files`) → multer `LIMIT_UNEXPECTED_FILE`.
// Sama seperti `LIMIT_FILE_COUNT`: `code` hilang setelah dibungkus Nest, jadi cek code ATAU message.
export const isUnexpectedFileError = (error: unknown): boolean => {
  const e = error as { code?: unknown; message?: unknown } | null | undefined;
  return (
    e?.code === 'LIMIT_UNEXPECTED_FILE' ||
    (typeof e?.message === 'string' && e.message.includes('LIMIT_UNEXPECTED_FILE'))
  );
};

// Trust boundary: `imageService.upload` tidak boleh menerima array kosong.
export const requireUploadedFiles = (
  files: Express.Multer.File[] | undefined,
): Express.Multer.File[] => {
  if (!files || files.length === 0) throw validationError('files', 'files must not be empty');
  return files;
};

// Error map multi-file (dipakai `MulterUploadManyInterceptor` + self-check).
export const toUploadManyError = (error: unknown, maxMb: number): never => {
  if (error instanceof PayloadTooLargeException) {
    throw validationError('files', `files must each be at most ${maxMb} MB`);
  }
  if (isLimitFileCountError(error)) {
    throw validationError('files', `at most ${MAX_UPLOAD_FILES} files are allowed`);
  }
  if (isUnexpectedFileError(error)) {
    throw validationError('files', 'unexpected file field; send files');
  }
  throw error;
};

// Multer batasi buffer agar file besar tidak ditampung penuh di memory (DoS).
// Nest memetakan LIMIT_FILE_SIZE → PayloadTooLargeException (413); kontrak butuh 422.
@Injectable()
export class MulterUploadInterceptor implements NestInterceptor {
  private readonly delegate: NestInterceptor;

  constructor(config: ConfigService) {
    const Delegate = FileInterceptor('file', buildImageUploadOptions(config, 'file', 1));
    this.delegate = new Delegate();
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return from(this.delegate.intercept(context, next)).pipe(
      switchMap((stream) => stream),
      catchError((error: unknown) => {
        if (error instanceof PayloadTooLargeException) {
          throw validationError('file', 'file too large');
        }
        throw error;
      }),
    );
  }
}

// Varian multi-file (maks `MAX_UPLOAD_FILES`, field `files`) untuk upload gambar publik.
@Injectable()
export class MulterUploadManyInterceptor implements NestInterceptor {
  private readonly delegate: NestInterceptor;
  private readonly maxMb: number;

  constructor(config: ConfigService) {
    this.maxMb = resolveUploadMaxSizeMb(config);
    const Delegate = FilesInterceptor(
      'files',
      MAX_UPLOAD_FILES,
      buildImageUploadOptions(config, 'files', MAX_UPLOAD_FILES),
    );
    this.delegate = new Delegate();
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return from(this.delegate.intercept(context, next)).pipe(
      switchMap((stream) => stream),
      catchError((error: unknown) => toUploadManyError(error, this.maxMb)),
    );
  }
}
