import { registerAs } from '@nestjs/config';

export default registerAs('telemetry', () => ({
  enabled: process.env.OTEL_ENABLED !== 'false',
  serviceName: process.env.SERVICE_NAME ?? 'amrutam-backend',
  serviceVersion: process.env.APP_VERSION ?? '1.0.0',
  prometheusPort: parseInt(process.env.PROMETHEUS_PORT ?? '9464', 10),
  jaegerEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
  slowRequestThresholdMs: parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS ?? '1000', 10),
  slowQueryThresholdMs: parseInt(process.env.SLOW_QUERY_THRESHOLD_MS ?? '500', 10),
}));
