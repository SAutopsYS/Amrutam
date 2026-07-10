import { registerAs } from '@nestjs/config';

export default registerAs('swagger', () => ({
  enabled: process.env.SWAGGER_ENABLED !== 'false',
  title: 'Amrutam Telemedicine API',
  description: 'Production-grade telemedicine platform API',
  version: '1.0.0',
  path: 'docs',
}));
