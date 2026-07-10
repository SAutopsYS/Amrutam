import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { QueueModule } from '@/queues/queue.module';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';
import { QueueHealthIndicator } from './queue.health';
import { MemoryHealthIndicator } from './memory.health';
import { DiskHealthIndicator } from './disk.health';

@Module({
  imports: [TerminusModule, QueueModule],
  controllers: [HealthController],
  providers: [
    PrismaHealthIndicator,
    RedisHealthIndicator,
    QueueHealthIndicator,
    MemoryHealthIndicator,
    DiskHealthIndicator,
  ],
})
export class HealthModule {}
