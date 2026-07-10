import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/jwt-auth.guard';
import { RolesGuard } from '@modules/rbac/guards/roles.guard';
import { Roles } from '@common/decorators/auth.decorators';
import { RoleName } from '@common/constants';
import {
  ApiStandardErrorResponses,
  successEnvelopeExample,
} from '@common/swagger/api-responses.decorator';
import { DashboardService } from '../application/services/dashboard.service';
import { AnalyticsService } from '@modules/analytics/application/services/analytics.service';
import { AuditService } from '@modules/audit/application/audit.service';
import { SearchService } from '@modules/search/application/services/search.service';
import { DeadLetterService } from '@modules/event-processing/infrastructure/dead-letter.service';
import { PrismaService } from '@database/prisma.service';

@ApiTags('Admin')
@ApiBearerAuth()
@ApiStandardErrorResponses()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly analyticsService: AnalyticsService,
    private readonly auditService: AuditService,
    private readonly searchService: SearchService,
    private readonly deadLetterService: DeadLetterService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Admin dashboard metrics',
    description: 'Aggregated KPIs cached in Redis (60s TTL).',
  })
  @ApiOkResponse({ description: 'Dashboard data', schema: { example: successEnvelopeExample } })
  dashboard() {
    return this.dashboardService.getDashboard();
  }

  @Get('analytics')
  @ApiOperation({
    summary: 'Analytics reporting',
    description: 'Time-series appointment and revenue metrics by period.',
  })
  @ApiOkResponse({ description: 'Analytics data', schema: { example: successEnvelopeExample } })
  analytics(
    @Query('period') period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom' = 'daily',
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.analyticsService.getAnalytics({
      period,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });
  }

  @Get('audit')
  @ApiOperation({
    summary: 'Immutable audit history',
    description: 'Filterable audit log for compliance and incident investigation.',
  })
  @ApiOkResponse({ description: 'Audit entries', schema: { example: successEnvelopeExample } })
  audit(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.query({
      userId,
      action,
      resourceType,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      cursor,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get('search')
  @ApiOperation({
    summary: 'Global admin search',
    description: 'Search across patients, doctors, and appointments by keyword.',
  })
  @ApiOkResponse({ description: 'Search results', schema: { example: successEnvelopeExample } })
  search(
    @Query('keyword') keyword: string,
    @Query('types') types?: string,
    @Query('limit') limit?: number,
  ) {
    return this.searchService.globalSearch({
      keyword,
      types: types ? types.split(',') : undefined,
      limit: limit ? Number(limit) : 10,
      isAdmin: true,
    });
  }

  @Get('system-health')
  @ApiOperation({
    summary: 'System health and queue metrics',
    description: 'Database connectivity and dead-letter queue depth for ops dashboards.',
  })
  @ApiOkResponse({
    description: 'System health snapshot',
    schema: {
      example: {
        database: 'healthy',
        queues: { deadLetterCount: 0, pendingOutbox: 2 },
        timestamp: '2026-07-09T12:00:00.000Z',
      },
    },
  })
  async systemHealth() {
    const [dbCheck, queueMetrics] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`,
      this.deadLetterService.getMetrics(),
    ]);

    return {
      database: dbCheck ? 'healthy' : 'unhealthy',
      queues: queueMetrics,
      timestamp: new Date().toISOString(),
    };
  }
}
