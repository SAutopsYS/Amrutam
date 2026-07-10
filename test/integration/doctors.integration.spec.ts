import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Doctors endpoints (integration)', () => {
  let app: INestApplication;
  let doctorId: string;

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

  it('GET /doctors returns verified doctors (cached search)', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/doctors?keyword=ayurveda');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    if (response.body.data.length > 0) {
      doctorId = response.body.data[0].id;
    }
  });

  it('GET /doctors/:id returns doctor profile', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/doctors');
    const id = list.body.data?.[0]?.id;
    if (!id) return;

    const response = await request(app.getHttpServer()).get(`/api/v1/doctors/${id}`);
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(id);
  });

  it('GET /doctors/:id/slots returns available slots', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/doctors');
    const id = list.body.data?.[0]?.id ?? doctorId;
    if (!id) return;

    const response = await request(app.getHttpServer()).get(`/api/v1/doctors/${id}/slots`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
