import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import * as fs from 'fs';

@Injectable()
export class DiskHealthIndicator extends HealthIndicator {
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      fs.accessSync(process.cwd(), fs.constants.W_OK);
      return this.getStatus(key, true, { writable: true });
    } catch (error) {
      throw new HealthCheckError('Disk check failed', this.getStatus(key, false, { error }));
    }
  }
}
