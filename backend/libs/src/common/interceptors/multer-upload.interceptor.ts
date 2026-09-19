import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { catchError, from, Observable, switchMap } from 'rxjs';

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];

// Multer batasi buffer agar file besar tidak ditampung penuh di memory (DoS).
// Nest memetakan LIMIT_FILE_SIZE → PayloadTooLargeException (413); kontrak butuh 422.
@Injectable()
export class MulterUploadInterceptor implements NestInterceptor {
  private readonly delegate: NestInterceptor;

  constructor(config: ConfigService) {
    const maxBytes = Number(config.get('UPLOAD_MAX_SIZE_MB') ?? 5) * 1024 * 1024;
    const Delegate = FileInterceptor('file', {
      limits: { files: 1, fileSize: maxBytes },
      fileFilter: (_req, file, callback) => {
        if (ALLOWED_MIME.includes(file.mimetype)) {
          callback(null, true);
          return;
        }
        callback(
          new UnprocessableEntityException({
            message: 'Validation failed',
            errors: [
              {
                field: 'file',
                message: 'file must be one of: image/png, image/jpeg, image/webp',
              },
            ],
          }),
          false,
        );
      },
    });
    this.delegate = new Delegate();
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return from(this.delegate.intercept(context, next)).pipe(
      switchMap((stream) => stream),
      catchError((error: unknown) => {
        if (error instanceof PayloadTooLargeException) {
          throw new UnprocessableEntityException({
            message: 'Validation failed',
            errors: [{ field: 'file', message: 'file too large' }],
          });
        }
        throw error;
      }),
    );
  }
}
