import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { ShutdownService } from '@/shutdown/shutdown.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  const configService = app.get(ConfigService);
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  const maxPayloadSize = configService.get<string>('security.maxPayloadSize') ?? '1mb';

  app.use(
    helmet({
      contentSecurityPolicy: configService.get<string>('app.nodeEnv') === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(json({ limit: maxPayloadSize }));
  app.use(urlencoded({ extended: true, limit: maxPayloadSize }));

  app.enableCors({
    origin: configService.get<string[]>('app.corsOrigins'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Correlation-Id',
      'Idempotency-Key',
    ],
  });

  app.setGlobalPrefix(configService.get<string>('app.apiPrefix') ?? 'api/v1');
  app.enableVersioning({ type: VersioningType.URI });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (configService.get<boolean>('swagger.enabled')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Amrutam Telemedicine API')
      .setDescription(
        'Production-grade telemedicine backend API.\n\n' +
          '## Authentication\n' +
          'Protected endpoints require a JWT bearer token:\n' +
          '```\nAuthorization: Bearer <access_token>\n```\n\n' +
          'Login via `POST /auth/login`. If MFA is enrolled, the response is\n' +
          '`{ mfaRequired: true, mfaToken }` — complete with `POST /auth/mfa/verify`.\n\n' +
          'Generate development tokens after seeding:\n' +
          '```bash\nnpm run token:patient\nnpm run token:doctor\n```\n\n' +
          'In Swagger UI, click **Authorize** and enter `Bearer <token>`.\n\n' +
          '## Idempotency\n' +
          'POST `/appointments` requires an `Idempotency-Key` header (UUID recommended).\n\n' +
          '## Response Format\n' +
          'All responses use a standard envelope: `{ success, data, meta, requestId, timestamp }`.\n' +
          'Errors return `{ success: false, code, message, details, requestId, timestamp }`.\n\n' +
          '## Canonical Specification\n' +
          'Full OpenAPI 3.1 YAML with request/response examples: `docs/openapi.yaml`.',
      )
      .setVersion(configService.get<string>('telemetry.serviceVersion') ?? '1.0.0')
      .setExternalDoc('OpenAPI 3.1 Specification (YAML)', '/openapi.yaml')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT access token' },
        'access-token',
      )
      .addApiKey(
        {
          type: 'apiKey',
          name: 'Idempotency-Key',
          in: 'header',
          description: 'Required for POST /appointments',
        },
        'Idempotency-Key',
      )
      .addServer('http://localhost:3000', 'Local development')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs/json',
      yamlDocumentUrl: 'docs/yaml',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
      },
    });

    const openApiPath = join(process.cwd(), 'docs', 'openapi.yaml');
    if (existsSync(openApiPath)) {
      app.getHttpAdapter().get('/openapi.yaml', (_req, res) => {
        res.type('application/yaml').send(readFileSync(openApiPath, 'utf8'));
      });
    }
  }

  app.enableShutdownHooks();
  const shutdownService = app.get(ShutdownService);

  const port = configService.get<number>('app.port') ?? 3000;
  await app.listen(port);

  logger.log({
    message: 'Application started',
    port,
    environment: configService.get<string>('app.nodeEnv'),
    serviceName: configService.get<string>('telemetry.serviceName'),
    level: 'info',
    timestamp: new Date().toISOString(),
  });

  const gracefulShutdown = async (signal: string) => {
    logger.log({ message: `Received ${signal}, shutting down`, level: 'info' });
    await app.close();
    await shutdownService.onModuleDestroy();
    process.exit(0);
  };

  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
}

bootstrap();
