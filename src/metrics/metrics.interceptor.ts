import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from '@/metrics/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { method, route } = request;
    const routePath = route?.path ?? request.originalUrl ?? 'unknown';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          this.metricsService.recordHttpRequest(
            method,
            routePath,
            response.statusCode,
            Date.now() - start,
          );
        },
        error: () => {
          this.metricsService.recordHttpRequest(method, routePath, 500, Date.now() - start);
        },
      }),
    );
  }
}
