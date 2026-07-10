import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { MetricsService } from '@/metrics/metrics.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    this.client = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      password: this.configService.get<string>('redis.password'),
      db: this.configService.get<number>('redis.db'),
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<string> {
    const start = Date.now();
    const result = await this.client.ping();
    this.metricsService.recordRedisOperation('ping', Date.now() - start);
    return result;
  }

  async get(key: string): Promise<string | null> {
    const start = Date.now();
    const result = await this.client.get(key);
    this.metricsService.recordRedisOperation('get', Date.now() - start);
    return result;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const start = Date.now();
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
    this.metricsService.recordRedisOperation('set', Date.now() - start);
  }

  async del(...keys: string[]): Promise<void> {
    const start = Date.now();
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
    this.metricsService.recordRedisOperation('del', Date.now() - start);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
