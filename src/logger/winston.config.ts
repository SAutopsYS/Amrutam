import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { buildLogEntry } from './log-formatter';

const serviceName = process.env.SERVICE_NAME ?? 'amrutam-backend';
const serviceVersion = process.env.APP_VERSION ?? '1.0.0';
const environment = process.env.NODE_ENV ?? 'development';

export const winstonConfig = WinstonModule.forRoot({
  defaultMeta: {
    serviceName,
    serviceVersion,
    environment,
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: environment !== 'production' }),
        winston.format((info) => {
          const entry = buildLogEntry(
            info.level,
            String(info.message),
            info as Record<string, unknown>,
          );
          return { ...info, ...entry };
        })(),
        winston.format.json(),
      ),
    }),
  ],
});
