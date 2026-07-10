import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Inject,
  LoggerService,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { IS_PUBLIC_KEY } from '@common/decorators/auth.decorators';
import { AUDIT_ACTIONS } from '@common/constants';
import { buildLogEntry } from '@/logger/log-formatter';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser>(
    err: Error | null,
    user: TUser,
    info: Error | undefined,
    context: ExecutionContext,
  ): TUser {
    const request = context.switchToHttp().getRequest();
    const ctx = request.requestContext ?? {};

    if (err || !user) {
      const isExpired = info?.name === 'TokenExpiredError';
      this.logger.warn(
        buildLogEntry('warn', isExpired ? 'Token expired' : 'Authentication failed', {
          requestId: ctx.requestId,
          correlationId: ctx.correlationId,
          action: isExpired ? 'TOKEN_EXPIRED' : AUDIT_ACTIONS.FAILED_LOGIN,
          route: request.originalUrl,
          ip: ctx.ip,
        }),
      );
      throw (
        err ?? new UnauthorizedException(isExpired ? 'Token expired' : 'Authentication required')
      );
    }

    return user;
  }
}
