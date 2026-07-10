import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly httpRequestTotal: Counter<string>;
  readonly httpRequestDuration: Histogram<string>;
  readonly httpErrorTotal: Counter<string>;
  readonly slowRequestTotal: Counter<string>;
  readonly dbQueryDuration: Histogram<string>;
  readonly redisLatency: Histogram<string>;
  readonly queueLength: Gauge<string>;
  readonly queueProcessingDuration: Histogram<string>;
  readonly queueFailures: Counter<string>;
  readonly cacheHits: Counter<string>;
  readonly cacheMisses: Counter<string>;

  private slowRequestThresholdMs: number;

  constructor(private readonly configService: ConfigService) {
    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.httpErrorTotal = new Counter({
      name: 'http_errors_total',
      help: 'Total HTTP errors (4xx/5xx)',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.slowRequestTotal = new Counter({
      name: 'http_slow_requests_total',
      help: 'Requests exceeding slow threshold',
      labelNames: ['method', 'route'],
      registers: [this.registry],
    });

    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Database query duration',
      labelNames: ['model', 'operation'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
      registers: [this.registry],
    });

    this.redisLatency = new Histogram({
      name: 'redis_operation_duration_seconds',
      help: 'Redis operation latency',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
      registers: [this.registry],
    });

    this.queueLength = new Gauge({
      name: 'queue_jobs_waiting',
      help: 'Number of jobs waiting in queue',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.queueProcessingDuration = new Histogram({
      name: 'queue_processing_duration_seconds',
      help: 'Queue job processing duration',
      labelNames: ['queue', 'job'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });

    this.queueFailures = new Counter({
      name: 'queue_failures_total',
      help: 'Total queue job failures',
      labelNames: ['queue', 'job'],
      registers: [this.registry],
    });

    this.cacheHits = new Counter({
      name: 'cache_hits_total',
      help: 'Cache hits',
      labelNames: ['layer'],
      registers: [this.registry],
    });

    this.cacheMisses = new Counter({
      name: 'cache_misses_total',
      help: 'Cache misses',
      labelNames: ['layer'],
      registers: [this.registry],
    });

    this.slowRequestThresholdMs = 1000;
  }

  onModuleInit(): void {
    this.slowRequestThresholdMs =
      this.configService.get<number>('telemetry.slowRequestThresholdMs') ?? 1000;
    collectDefaultMetrics({ register: this.registry });
  }

  recordHttpRequest(method: string, route: string, statusCode: number, durationMs: number): void {
    const labels = { method, route, status_code: String(statusCode) };
    this.httpRequestTotal.inc(labels);
    this.httpRequestDuration.observe(labels, durationMs / 1000);

    if (statusCode >= 400) {
      this.httpErrorTotal.inc(labels);
    }

    if (durationMs >= this.slowRequestThresholdMs) {
      this.slowRequestTotal.inc({ method, route });
    }
  }

  recordDbQuery(model: string, operation: string, durationMs: number): void {
    this.dbQueryDuration.observe({ model, operation }, durationMs / 1000);
  }

  recordRedisOperation(operation: string, durationMs: number): void {
    this.redisLatency.observe({ operation }, durationMs / 1000);
  }

  recordCacheAccess(result: 'hit' | 'miss', layer = 'redis'): void {
    if (result === 'hit') {
      this.cacheHits.inc({ layer });
    } else {
      this.cacheMisses.inc({ layer });
    }
  }

  setQueueLength(queue: string, count: number): void {
    this.queueLength.set({ queue }, count);
  }

  recordQueueJob(queue: string, job: string, durationMs: number, failed: boolean): void {
    this.queueProcessingDuration.observe({ queue, job }, durationMs / 1000);
    if (failed) {
      this.queueFailures.inc({ queue, job });
    }
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
