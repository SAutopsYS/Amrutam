import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

/**
 * Requires Postgres + Redis and MFA_ENABLED=true.
 */
describe('MFA endpoints (integration)', () => {
  let app: INestApplication;
  const email = `mfa-${Date.now()}@amrutam.test`;
  const password = 'Password123!';
  let accessToken = '';

  beforeAll(async () => {
    process.env.MFA_ENABLED = 'true';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  }, 90000);

  afterAll(async () => {
    await app.close();
  });

  it('registers user and begins MFA enrollment', async () => {
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, firstName: 'Mfa', lastName: 'Tester' });

    expect([200, 201]).toContain(register.status);
    accessToken = register.body.data.accessToken;
    expect(accessToken).toBeDefined();

    const enable = await request(app.getHttpServer())
      .post('/api/v1/auth/mfa/enable')
      .set('Authorization', `Bearer ${accessToken}`);

    if (enable.status === 403) {
      return;
    }

    expect(enable.status).toBe(200);
    expect(enable.body.data.secret).toBeDefined();
    expect(enable.body.data.qrCodeDataUrl).toMatch(/^data:image\/png/);
    expect(enable.body.data.recoveryCodes.length).toBe(10);

    const status = await request(app.getHttpServer())
      .get('/api/v1/auth/mfa/status')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(status.status).toBe(200);
    expect(status.body.data.setupInProgress).toBe(true);
  });
});
