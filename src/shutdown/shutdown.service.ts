import { Injectable, OnModuleDestroy, Inject, LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { PrismaService } from '@database/prisma.service';
import { RedisService } from '@database/redis.service';
import { TracingService } from '@/telemetry/tracing.service';
import { QueueService } from '@/queues/queue.service';

@Injectable()
export class ShutdownService implements OnModuleDestroy {
  private isShuttingDown = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tracing: TracingService,
    private readonly queueService: QueueService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  isShuttingDownNow(): boolean {
    return this.isShuttingDown;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.logger.log({
      message: 'Graceful shutdown initiated',
      timestamp: new Date().toISOString(),
      level: 'info',
    });

    try {
      await this.queueService.onModuleDestroy();
      await this.redis.onModuleDestroy();
      await this.prisma.onModuleDestroy();
      await this.tracing.shutdown();

      this.logger.log({
        message: 'Graceful shutdown completed',
        timestamp: new Date().toISOString(),
        level: 'info',
      });
    } catch (error) {
      this.logger.error({
        message: 'Error during graceful shutdown',
        error: error instanceof Error ? error.message : 'Unknown',
        timestamp: new Date().toISOString(),
        level: 'error',
      });
    }
  }
}
