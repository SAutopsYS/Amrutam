import { plainToInstance, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  NODE_ENV!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  REDIS_HOST!: string;

  @Type(() => Number)
  @IsInt()
  REDIS_PORT!: number;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @Type(() => Number)
  @IsInt()
  REDIS_DB!: number;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  JWT_ACCESS_EXPIRES_IN!: string;

  @IsString()
  JWT_REFRESH_EXPIRES_IN!: string;

  @Type(() => Number)
  @IsInt()
  @Min(10)
  BCRYPT_ROUNDS!: number;

  @Type(() => Number)
  @IsInt()
  THROTTLE_TTL!: number;

  @Type(() => Number)
  @IsInt()
  THROTTLE_LIMIT!: number;

  @IsString()
  CORS_ORIGINS!: string;

  @Type(() => Boolean)
  @IsBoolean()
  SWAGGER_ENABLED!: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  MFA_ENABLED!: boolean;

  @Type(() => Number)
  @IsInt()
  BOOKING_CANCELLATION_HOURS!: number;

  @IsString()
  @MinLength(32)
  PAYMENT_WEBHOOK_SECRET!: string;

  @IsString()
  @IsOptional()
  SERVICE_NAME?: string;

  @IsString()
  @IsOptional()
  APP_VERSION?: string;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  OTEL_ENABLED?: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  METRICS_ENABLED?: boolean;

  @IsString()
  @IsOptional()
  MAX_PAYLOAD_SIZE?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  MAX_HEAP_USED_MB?: number;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  if (config.NODE_ENV === 'production') {
    const accessSecret = String(config.JWT_ACCESS_SECRET ?? '');
    if (accessSecret.includes('change-me')) {
      throw new Error('JWT_ACCESS_SECRET must be changed in production');
    }
  }

  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.toString()}`);
  }
  return validated;
}
