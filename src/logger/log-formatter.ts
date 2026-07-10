import { sanitizeForLog } from '@common/utils/masking.util';

export interface StructuredLogEntry {
  timestamp: string;
  level: string;
  message: string;
  requestId?: string;
  correlationId?: string;
  userId?: string;
  module?: string;
  method?: string;
  route?: string;
  statusCode?: number;
  executionTimeMs?: number;
  ip?: string;
  environment?: string;
  serviceName?: string;
  serviceVersion?: string;
  [key: string]: unknown;
}

export function buildLogEntry(
  level: string,
  message: string,
  meta: Record<string, unknown> = {},
): StructuredLogEntry {
  const sanitized = sanitizeForLog(meta);
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    environment: process.env.NODE_ENV ?? 'development',
    serviceName: process.env.SERVICE_NAME ?? 'amrutam-backend',
    serviceVersion: process.env.APP_VERSION ?? '1.0.0',
    ...sanitized,
  };
}
