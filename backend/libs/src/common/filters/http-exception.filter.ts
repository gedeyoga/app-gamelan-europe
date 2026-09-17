import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

interface ValidationErrorLike {
  property?: string;
  constraints?: Record<string, string>;
  children?: ValidationErrorLike[];
}

interface FieldError {
  field: string;
  message: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse() as unknown;

      if (status === HttpStatus.UNPROCESSABLE_ENTITY) {
        const errors = this.normalizeValidationErrors(res);
        response.status(status).json({
          statusCode: status,
          message: 'Validation failed',
          errors,
        });
        return;
      }

      const text = typeof res === 'string' ? res : (res as { message?: unknown })?.message;
      const message = Array.isArray(text)
        ? (text as unknown[]).map((m) => String(m)).join(', ')
        : ((text as string) ?? exception.message);

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

  private normalizeValidationErrors(res: unknown): FieldError[] {
    let raw: unknown[] = [];

    if (Array.isArray(res)) {
      raw = res;
    } else if (res && typeof res === 'object') {
      const body = res as { message?: unknown; errors?: unknown };
      if (Array.isArray(body.message)) raw = body.message;
      else if (Array.isArray(body.errors)) raw = body.errors;
      else return [];
    } else {
      return [];
    }

    const out: FieldError[] = [];
    for (const item of raw) {
      if (typeof item === 'string') {
        out.push(this.parseStringMessage(item));
      } else if (item && typeof item === 'object' && 'property' in (item as Record<string, unknown>)) {
        this.flattenValidationError(item as ValidationErrorLike, undefined, out);
      } else if (
        item &&
        typeof item === 'object' &&
        'field' in (item as Record<string, unknown>) &&
        'message' in (item as Record<string, unknown>)
      ) {
        const m = item as Record<string, unknown>;
        out.push({ field: String(m.field), message: String(m.message) });
      } else {
        out.push({ field: '', message: String(item) });
      }
    }
    return out;
  }

  private flattenValidationError(err: ValidationErrorLike, parentPath: string | undefined, out: FieldError[]): void {
    const path = parentPath ? `${parentPath}.${err.property ?? ''}` : (err.property ?? '');

    if (err.constraints) {
      const messages = Object.values(err.constraints);
      for (const msg of messages) {
        out.push({ field: path, message: String(msg) });
      }
    }

    if (Array.isArray(err.children) && err.children.length > 0) {
      for (const child of err.children) {
        this.flattenValidationError(child, path || undefined, out);
      }
      return;
    }

    if (!err.constraints && path) {
      out.push({ field: path, message: `${path} is invalid` });
    }
  }

  private parseStringMessage(m: string): FieldError {
    // forbidNonWhitelisted: "property foo should not exist"
    const propMatch = m.match(/^property\s+([^\s,]+)/i);
    if (propMatch?.[1]) {
      return { field: propMatch[1], message: m };
    }
    // Default class-validator: "<property> <constraint...>" e.g. "email must be an email"
    // Array items: "permissionIds.0 must be a UUID" -> keep full path as field.
    const first = m.split(' ')[0] ?? '';
    if (first && /^[A-Za-z0-9_.\[\]]+$/.test(first)) {
      return { field: first, message: m };
    }
    return { field: '', message: m };
  }
}
