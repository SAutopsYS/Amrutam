import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import * as os from 'os';

@Injectable()
export class MemoryHealthIndicator extends HealthIndicator {
  private readonly maxHeapUsedMb: number;

  constructor() {
    super();
    this.maxHeapUsedMb = parseInt(process.env.MAX_HEAP_USED_MB ?? '512', 10);
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const mem = process.memoryUsage();
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const isHealthy = heapUsedMb < this.maxHeapUsedMb;

    const details = {
      heapUsedMb,
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      rssMb: Math.round(mem.rss / 1024 / 1024),
      freeSystemMemoryMb: Math.round(os.freemem() / 1024 / 1024),
    };

    if (!isHealthy) {
      throw new HealthCheckError('Memory threshold exceeded', this.getStatus(key, false, details));
    }

    return this.getStatus(key, true, details);
  }
}
