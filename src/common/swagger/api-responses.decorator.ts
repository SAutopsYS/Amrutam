import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

const errorExample = (code: string, message: string, status: number) => ({
  description: message,
  schema: {
    example: {
      success: false,
      code,
      message,
      details: null,
      requestId: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: '2026-07-09T12:00:00.000Z',
    },
  },
  status,
});

/** Standard error responses shared across authenticated endpoints. */
export function ApiStandardErrorResponses() {
  return applyDecorators(
    ApiUnauthorizedResponse(errorExample('UNAUTHORIZED', 'Invalid or missing bearer token', 401)),
    ApiForbiddenResponse(errorExample('FORBIDDEN', 'Insufficient role or resource access', 403)),
    ApiBadRequestResponse(errorExample('VALIDATION_ERROR', 'Request validation failed', 400)),
    ApiNotFoundResponse(errorExample('NOT_FOUND', 'Resource not found', 404)),
    ApiConflictResponse(errorExample('SLOT_ALREADY_BOOKED', 'Slot is no longer available', 409)),
    ApiTooManyRequestsResponse(errorExample('FORBIDDEN', 'Rate limit exceeded', 429)),
    ApiInternalServerErrorResponse(
      errorExample('INTERNAL_ERROR', 'An unexpected error occurred', 500),
    ),
  );
}

/** Success envelope used by ResponseInterceptor. */
export const successEnvelopeExample = {
  success: true,
  data: {},
  meta: {},
  requestId: '550e8400-e29b-41d4-a716-446655440000',
  timestamp: '2026-07-09T12:00:00.000Z',
};
