import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants';

/**
 * Domain exception mapped to standardized API error responses.
 * Never expose internal stack traces — only code + safe message.
 */
export class DomainException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details: unknown = null,
  ) {
    super({ code, message, details }, status);
  }
}
