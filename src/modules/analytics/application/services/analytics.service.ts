import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { CacheService } from '@common/cache/cache.service';
export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getAnalytics(params: { period: AnalyticsPeriod; fromDate?: Date; toDate?: Date }) {
    const { from, to } = this.resolveDateRange(params);
    const cacheKey = `analytics:${params.period}:${from.toISOString()}:${to.toISOString()}`;

    return this.cache.getOrSet(cacheKey, () => this.buildAnalytics(from, to, params.period), 120);
  }

  private async buildAnalytics(from: Date, to: Date, period: AnalyticsPeriod) {
    const [appointments, consultations, payments, newPatients] = await Promise.all([
      this.prisma.appointment.groupBy({
        by: ['status'],
        where: { createdAt: { gte: from, lte: to } },
        _count: { id: true },
      }),
      this.prisma.consultation.groupBy({
        by: ['status'],
        where: { createdAt: { gte: from, lte: to } },
        _count: { id: true },
      }),
      this.prisma.payment.aggregate({
        where: { createdAt: { gte: from, lte: to }, status: 'CAPTURED' },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.user.count({ where: { createdAt: { gte: from, lte: to } } }),
    ]);

    return {
      period,
      fromDate: from,
      toDate: to,
      appointments: appointments.map((a) => ({ status: a.status, count: a._count.id })),
      consultations: consultations.map((c) => ({ status: c.status, count: c._count.id })),
      revenue: { total: Number(payments._sum.amount ?? 0), transactions: payments._count.id },
      newPatients,
    };
  }

  private resolveDateRange(params: { period: AnalyticsPeriod; fromDate?: Date; toDate?: Date }) {
    const to = params.toDate ?? new Date();
    const from = params.fromDate ?? new Date();

    if (!params.fromDate) {
      switch (params.period) {
        case 'daily':
          from.setHours(0, 0, 0, 0);
          break;
        case 'weekly':
          from.setDate(from.getDate() - 7);
          break;
        case 'monthly':
          from.setMonth(from.getMonth() - 1);
          break;
        case 'yearly':
          from.setFullYear(from.getFullYear() - 1);
          break;
        default:
          from.setDate(from.getDate() - 30);
      }
    }

    return { from, to };
  }
}
