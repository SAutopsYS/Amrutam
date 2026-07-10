import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@common/constants';

export interface RetryConfig {
  attempts: number;
  backoff: { type: 'exponential'; delay: number };
}

export const DEFAULT_RETRY: RetryConfig = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
};

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private connection!: ConnectionOptions;
  private queues = new Map<string, Queue>();
  private workers = new Map<string, Worker>();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.connection = {
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      password: this.configService.get<string>('redis.password'),
      db: this.configService.get<number>('redis.db'),
      maxRetriesPerRequest: null,
    };
  }

  getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      this.queues.set(
        name,
        new Queue(name, {
          connection: this.connection,
          defaultJobOptions: {
            attempts: DEFAULT_RETRY.attempts,
            backoff: DEFAULT_RETRY.backoff,
            removeOnComplete: 100,
            removeOnFail: false,
          },
        }),
      );
    }
    return this.queues.get(name)!;
  }

  registerWorker(
    queueName: string,
    processor: (job: Job) => Promise<void>,
    onFailed?: (job: Job | undefined, error: Error) => Promise<void>,
  ): Worker {
    const worker = new Worker(queueName, processor, { connection: this.connection });
    if (onFailed) {
      worker.on('failed', (job, error) => {
        void onFailed(job, error);
      });
    }
    this.workers.set(queueName, worker);
    return worker;
  }

  async addJob(
    queueName: string,
    jobName: string,
    data: Record<string, unknown>,
    opts?: { delay?: number },
  ) {
    const queue = this.getQueue(queueName);
    return queue.add(jobName, data, {
      ...opts,
      jobId: `${jobName}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });
  }

  async getQueueMetrics(queueName: string) {
    const queue = this.getQueue(queueName);
    const [waiting, active, failed, completed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getFailedCount(),
      queue.getCompletedCount(),
    ]);
    return { waiting, active, failed, completed };
  }

  async onModuleDestroy(): Promise<void> {
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
  }
}

export { QUEUE_NAMES, JOB_NAMES };
