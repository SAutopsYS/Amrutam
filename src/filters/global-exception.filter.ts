import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
  LoggerService,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Request, Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode, AUDIT_ACTIONS } from '@common/constants';
import { ApiErrorResponse } from '@common/interfaces/api-response.interface';
import { buildLogEntry } from '@/logger/log-formatter';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<
      Request & {
        requestContext?: {
          requestId: string;
          correlationId?: string;
          userId?: string;
          ip?: string;
        };
      }
    >();

    const requestId = request.requestContext?.requestId ?? 'unknown';
    const correlationId = request.requestContext?.correlationId ?? requestId;
    const timestamp = new Date().toISOString();
    const isProduction = this.configService.get<string>('app.nodeEnv') === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = ErrorCode.INTERNAL_ERROR;
    let message = 'An unexpected error occurred';
    let details: unknown = null;

    if (exception instanceof DomainException) {
      status = exception.getStatus();
      code = exception.code;
      const responseBody = exception.getResponse() as { message?: string; details?: unknown };
      message = responseBody.message ?? exception.message;
      details = exception.details ?? responseBody.details ?? null;

      if (code === ErrorCode.FORBIDDEN) {
        this.logger.warn(
          buildLogEntry('warn', 'Permission denied', {
            requestId,
            correlationId,
            userId: request.requestContext?.userId,
            action: AUDIT_ACTIONS.PERMISSION_DENIED,
            route: request.originalUrl,
            ip: request.requestContext?.ip,
          }),
        );
      }
    } else if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      code = ErrorCode.FORBIDDEN;
      message = 'Rate limit exceeded';
      this.logger.warn(
        buildLogEntry('warn', 'Rate limit triggered', {
          requestId,
          correlationId,
          action: 'RATE_LIMIT_TRIGGERED',
          route: request.originalUrl,
          ip: request.requestContext?.ip,
        }),
      );
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();
      if (typeof responseBody === 'object' && responseBody !== null) {
        const body = responseBody as Record<string, unknown>;
        code = (body.code as ErrorCode) ?? ErrorCode.VALIDATION_ERROR;
        message = Array.isArray(body.message)
          ? body.message.join(', ')
          : String(body.message ?? exception.message);
        details = body.details ?? null;
      } else {
        message = String(responseBody);
        code = ErrorCode.VALIDATION_ERROR;
      }
    } else if (!isProduction) {
      this.logger.error(
        buildLogEntry('error', 'Unhandled exception', {
          requestId,
          correlationId,
          error: exception instanceof Error ? exception.message : 'Unknown',
          stack: exception instanceof Error ? exception.stack : undefined,
        }),
      );
    } else {
      this.logger.error(
        buildLogEntry('error', 'Unhandled exception', {
          requestId,
          correlationId,
        }),
      );
    }

    const errorResponse: ApiErrorResponse = {
      success: false,
      code,
      message,
      details: isProduction && status === HttpStatus.INTERNAL_SERVER_ERROR ? null : details,
      requestId,
      timestamp,
    };

    response.status(status).json(errorResponse);
  }
}
