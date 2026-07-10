import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { DeadLetterStatus } from '@prisma/client';
import { QUEUE_NAMES } from '@common/constants';
import { QueueService } from '@/queues/queue.service';

@Injectable()
export class DeadLetterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async moveToDeadLetter(
    queueName: string,
    jobName: string,
    payload: Record<string, unknown>,
    errorMessage: string,
    retryCount: number,
  ) {
    return this.prisma.deadLetterEvent.create({
      data: {
        queueName,
        jobName,
        payload: payload as object,
        errorMessage,
        retryCount,
        status: DeadLetterStatus.PENDING,
      },
    });
  }

  async getDlqCount(): Promise<number> {
    return this.prisma.deadLetterEvent.count({ where: { status: DeadLetterStatus.PENDING } });
  }

  async replay(id: string): Promise<void> {
    const event = await this.prisma.deadLetterEvent.findUniqueOrThrow({ where: { id } });
    await this.queueService.addJob(
      event.queueName,
      event.jobName,
      event.payload as Record<string, unknown>,
    );
    await this.prisma.deadLetterEvent.update({
      where: { id },
      data: { status: DeadLetterStatus.REPLAYED, replayedAt: new Date() },
    });
  }

  async getMetrics() {
    const dlqCount = await this.getDlqCount();
    const outboxMetrics = await this.queueService.getQueueMetrics(QUEUE_NAMES.OUTBOX);
    const notificationMetrics = await this.queueService.getQueueMetrics(QUEUE_NAMES.NOTIFICATIONS);
    return { dlqCount, outboxMetrics, notificationMetrics };
  }
}
