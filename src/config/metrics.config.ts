import { registerAs } from '@nestjs/config';

export default registerAs('metrics', () => ({
  enabled: process.env.METRICS_ENABLED !== 'false',
  path: process.env.METRICS_PATH ?? '/metrics',
  defaultCacheTtlSeconds: parseInt(process.env.CACHE_DEFAULT_TTL_SECONDS ?? '60', 10),
  cacheLockTtlSeconds: parseInt(process.env.CACHE_LOCK_TTL_SECONDS ?? '10', 10),
}));
