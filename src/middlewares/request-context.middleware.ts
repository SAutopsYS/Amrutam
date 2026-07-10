import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CORRELATION_ID_HEADER, REQUEST_ID_HEADER } from '@common/constants';
import { RequestContext } from '@common/interfaces/api-response.interface';
import { runWithCorrelation } from '@common/context/correlation.context';

declare module 'express-serve-static-core' {
  interface Request {
    requestContext: RequestContext;
  }
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers[REQUEST_ID_HEADER] as string) ?? uuidv4();
    const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) ?? requestId;

    req.requestContext = {
      requestId,
      correlationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };

    res.setHeader(REQUEST_ID_HEADER, requestId);
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    runWithCorrelation({ correlationId, requestId }, () => next());
  }
}
