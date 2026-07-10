import 'reflect-metadata';
import { validateEnv } from '../../src/config/env.validation';

describe('Environment validation', () => {
  const validEnv = {
    NODE_ENV: 'test',
    PORT: 3000,
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_DB: 0,
    JWT_ACCESS_SECRET: 'test-access-secret-min-32-characters-long',
    JWT_REFRESH_SECRET: 'test-refresh-secret-min-32-characters-long',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    BCRYPT_ROUNDS: 12,
    THROTTLE_TTL: 60000,
    THROTTLE_LIMIT: 100,
    CORS_ORIGINS: 'http://localhost:3000',
    SWAGGER_ENABLED: false,
    MFA_ENABLED: false,
    BOOKING_CANCELLATION_HOURS: 24,
    PAYMENT_WEBHOOK_SECRET: 'test-webhook-secret-min-32-characters-long',
  };

  it('accepts valid configuration', () => {
    expect(() => validateEnv(validEnv)).not.toThrow();
  });

  it('rejects short JWT secrets', () => {
    expect(() => validateEnv({ ...validEnv, JWT_ACCESS_SECRET: 'short' })).toThrow();
  });

  it('rejects default secrets in production', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'change-me-access-secret-min-32-chars-long!!',
      }),
    ).toThrow('JWT_ACCESS_SECRET must be changed in production');
  });
});
