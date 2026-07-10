import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@database/redis.service';
import { MetricsService } from '@/metrics/metrics.service';

/**
 * Cache-aside with stampede protection via short-lived lock keys.
 * Prevents thundering herd on cache miss under high traffic.
 */
@Injectable()
export class CacheService {
  private readonly defaultTtl: number;
  private readonly lockTtl: number;

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    this.defaultTtl = this.configService.get<number>('metrics.defaultCacheTtlSeconds') ?? 60;
    this.lockTtl = this.configService.get<number>('metrics.cacheLockTtlSeconds') ?? 10;
  }

  private lockKey(key: string): string {
    return `lock:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const start = Date.now();
    const value = await this.redis.get(key);
    this.metricsService.recordRedisOperation('get', Date.now() - start);
    if (value) {
      this.metricsService.recordCacheAccess('hit');
      return JSON.parse(value) as T;
    }
    this.metricsService.recordCacheAccess('miss');
    return null;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const start = Date.now();
    await this.redis.set(key, JSON.stringify(value), ttlSeconds ?? this.defaultTtl);
    this.metricsService.recordRedisOperation('set', Date.now() - start);
  }

  async del(...keys: string[]): Promise<void> {
    const start = Date.now();
    await this.redis.del(...keys);
    this.metricsService.recordRedisOperation('del', Date.now() - start);
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const lock = this.lockKey(key);
    const client = this.redis.getClient();
    const acquired = await client.set(lock, '1', 'EX', this.lockTtl, 'NX');

    if (!acquired) {
      await this.sleep(50);
      const retry = await this.get<T>(key);
      if (retry !== null) return retry;
    }

    try {
      const value = await factory();
      await this.set(key, value, ttlSeconds);
      return value;
    } finally {
      await client.del(lock);
    }
  }

  async invalidatePattern(prefix: string): Promise<void> {
    const client = this.redis.getClient();
    const stream = client.scanStream({ match: `${prefix}*`, count: 100 });
    const keys: string[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (batch: string[]) => keys.push(...batch));
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });

    if (keys.length > 0) {
      await client.del(...keys);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
