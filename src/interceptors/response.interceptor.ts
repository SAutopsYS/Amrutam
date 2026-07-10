import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse } from '@common/interfaces/api-response.interface';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessResponse> {
    const request = context.switchToHttp().getRequest();
    const requestId = request.requestContext?.requestId ?? 'unknown';

    return next.handle().pipe(
      map((data) => {
        if (data?.success !== undefined) {
          return data;
        }

        const meta = data?.meta ?? {};
        const responseData = data?.data !== undefined ? data.data : data;

        return {
          success: true as const,
          data: responseData ?? {},
          meta,
          requestId,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
