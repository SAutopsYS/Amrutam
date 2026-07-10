import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import databaseConfig from './database.config';
import redisConfig from './redis.config';
import jwtConfig from './jwt.config';
import securityConfig from './security.config';
import swaggerConfig from './swagger.config';
import telemetryConfig from './telemetry.config';
import metricsConfig from './metrics.config';
import { validateEnv } from './env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        jwtConfig,
        securityConfig,
        swaggerConfig,
        telemetryConfig,
        metricsConfig,
      ],
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
