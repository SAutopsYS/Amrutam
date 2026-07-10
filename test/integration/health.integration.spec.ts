import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Health endpoints (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health/live returns 200', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health/live');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('GET /api/v1/health returns health check result', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');
    expect([200, 503]).toContain(response.status);
    expect(response.body).toHaveProperty('status');
  });

  it('GET /api/v1/metrics returns prometheus format', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/metrics');
    expect(response.status).toBe(200);
    expect(response.text).toContain('http_requests_total');
  });
});
