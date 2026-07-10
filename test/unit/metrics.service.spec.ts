import { MetricsService } from '../../src/metrics/metrics.service';

describe('MetricsService', () => {
  const configService = {
    get: jest.fn().mockReturnValue(1000),
  };

  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService(configService as never);
    service.onModuleInit();
  });

  it('records HTTP request metrics', async () => {
    service.recordHttpRequest('GET', '/health', 200, 50);
    const metrics = await service.getMetrics();
    expect(metrics).toContain('http_requests_total');
    expect(metrics).toContain('http_request_duration_seconds');
  });

  it('counts slow requests', async () => {
    service.recordHttpRequest('POST', '/appointments', 201, 1500);
    const metrics = await service.getMetrics();
    expect(metrics).toContain('http_slow_requests_total');
  });

  it('counts HTTP errors', async () => {
    service.recordHttpRequest('GET', '/missing', 404, 10);
    const metrics = await service.getMetrics();
    expect(metrics).toContain('http_errors_total');
  });

  it('records cache hit and miss metrics', async () => {
    service.recordCacheAccess('hit');
    service.recordCacheAccess('miss');
    const metrics = await service.getMetrics();
    expect(metrics).toContain('cache_hits_total');
    expect(metrics).toContain('cache_misses_total');
  });
});
