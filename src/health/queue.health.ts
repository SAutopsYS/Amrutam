import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { QueueService } from '@/queues/queue.service';
import { QUEUE_NAMES } from '@common/constants';

@Injectable()
export class QueueHealthIndicator extends HealthIndicator {
  constructor(private readonly queueService: QueueService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const metrics = await this.queueService.getQueueMetrics(QUEUE_NAMES.OUTBOX);
      const isHealthy = metrics.failed < 1000;
      if (!isHealthy) {
        throw new Error('Queue failure threshold exceeded');
      }
      return this.getStatus(key, true, { waiting: metrics.waiting, failed: metrics.failed });
    } catch (error) {
      throw new HealthCheckError('Queue check failed', this.getStatus(key, false, { error }));
    }
  }
}
