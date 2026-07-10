import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Auth endpoints (integration)', () => {
  let app: INestApplication;
  const testEmail = `test-${Date.now()}@amrutam.test`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/register creates account and returns tokens', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: testEmail,
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
    });

    expect([200, 201]).toContain(response.status);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toBeDefined();
    expect(response.body.data.refreshToken).toBeDefined();
  });

  it('POST /auth/login returns tokens for seed user', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'patient@amrutam.test', password: 'Password123!' });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBeDefined();
  });

  it('POST /auth/login rejects invalid credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'patient@amrutam.test', password: 'wrong' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
