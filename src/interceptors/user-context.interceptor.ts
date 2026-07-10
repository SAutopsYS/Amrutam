import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { correlationStorage } from '@common/context/correlation.context';

/** Propagates authenticated user ID into request and correlation context. */
@Injectable()
export class UserContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { id?: string } | undefined;

    if (user?.id && request.requestContext) {
      request.requestContext.userId = user.id;
      const store = correlationStorage.getStore();
      if (store) {
        store.userId = user.id;
      }
    }

    return next.handle();
  }
}
