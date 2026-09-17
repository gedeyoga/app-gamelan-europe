import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Record<string, unknown>> {
    return next.handle().pipe(
      map((result) => {
        if (result && typeof result === 'object' && 'meta' in result && 'data' in result) {
          return { data: result.data, meta: result.meta, message: 'success' };
        }
        return { data: result, message: 'success' };
      }),
    );
  }
}