import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  LoggerService,
} from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { getCorrelationContext } from '@common/context/correlation.context';
import { buildLogEntry } from '@/logger/log-formatter';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { method, originalUrl, ip, route } = request;
    const ctx = request.requestContext ?? {};
    const correlation = getCorrelationContext();
    const start = Date.now();
    const moduleName = context.getClass().name;

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const executionTimeMs = Date.now() - start;
          this.logger.log(
            buildLogEntry('info', 'HTTP request completed', {
              requestId: ctx.requestId ?? correlation?.requestId,
              correlationId: ctx.correlationId ?? correlation?.correlationId,
              userId: ctx.userId ?? correlation?.userId,
              module: moduleName,
              method,
              route: route?.path ?? originalUrl,
              statusCode: response.statusCode,
              executionTimeMs,
              ip,
            }),
          );
        },
        error: (error: Error) => {
          const response = context.switchToHttp().getResponse();
          this.logger.error(
            buildLogEntry('error', 'HTTP request failed', {
              requestId: ctx.requestId ?? correlation?.requestId,
              correlationId: ctx.correlationId ?? correlation?.correlationId,
              userId: ctx.userId ?? correlation?.userId,
              module: moduleName,
              method,
              route: route?.path ?? originalUrl,
              statusCode: response.statusCode ?? 500,
              executionTimeMs: Date.now() - start,
              ip,
              error: error.message,
            }),
          );
        },
      }),
    );
  }
}
