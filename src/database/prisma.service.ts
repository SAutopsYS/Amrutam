import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Optional,
  LoggerService,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { MetricsService } from '@/metrics/metrics.service';
import { ConfigService } from '@nestjs/config';
import { buildLogEntry } from '@/logger/log-formatter';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
    @Optional()
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger?: LoggerService,
  ) {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    const slowQueryThreshold =
      this.configService.get<number>('telemetry.slowQueryThresholdMs') ?? 500;

    (
      this as PrismaClient & { $on(event: 'query', callback: (e: Prisma.QueryEvent) => void): void }
    ).$on('query', (event: Prisma.QueryEvent) => {
      this.metricsService.recordDbQuery('sql', 'query', event.duration);

      if (event.duration >= slowQueryThreshold) {
        this.logger?.warn(
          buildLogEntry('warn', 'Slow database query detected', {
            durationMs: event.duration,
            target: event.target,
          }),
        );
      }
    });

    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
