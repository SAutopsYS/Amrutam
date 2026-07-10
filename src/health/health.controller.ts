import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { Public } from '@common/decorators/auth.decorators';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';
import { QueueHealthIndicator } from './queue.health';
import { MemoryHealthIndicator } from './memory.health';
import { DiskHealthIndicator } from './disk.health';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private redisHealth: RedisHealthIndicator,
    private queueHealth: QueueHealthIndicator,
    private memoryHealth: MemoryHealthIndicator,
    private diskHealth: DiskHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({
    summary: 'Full system health check',
    description: 'Checks database, Redis, queue, memory, and disk.',
  })
  @ApiOkResponse({
    description: 'System healthy or degraded',
    schema: { example: { status: 'ok', info: {}, error: {}, details: {} } },
  })
  check() {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.redisHealth.isHealthy('redis'),
      () => this.queueHealth.isHealthy('queue'),
      () => this.memoryHealth.isHealthy('memory'),
      () => this.diskHealth.isHealthy('disk'),
    ]);
  }

  @Get('live')
  @Public()
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Returns 200 if the process is responsive. Used by Kubernetes liveness probes.',
  })
  @ApiOkResponse({ description: 'Process alive', schema: { example: { status: 'ok' } } })
  liveness() {
    return this.health.check([() => this.memoryHealth.isHealthy('memory')]);
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Returns 200 when database, Redis, and queue are reachable.',
  })
  @ApiOkResponse({ description: 'Ready to accept traffic', schema: { example: { status: 'ok' } } })
  readiness() {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.redisHealth.isHealthy('redis'),
      () => this.queueHealth.isHealthy('queue'),
    ]);
  }
}
