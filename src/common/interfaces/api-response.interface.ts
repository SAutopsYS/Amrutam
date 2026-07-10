export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta: Record<string, unknown>;
  requestId: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  code: string;
  message: string;
  details: unknown;
  requestId: string;
  timestamp: string;
}

export interface RequestContext {
  requestId: string;
  correlationId: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
}

export interface PaginatedMeta {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
  nextCursor?: string;
}
