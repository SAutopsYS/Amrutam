import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { CacheService } from '@common/cache/cache.service';
import { AppointmentStatus, ConsultationStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getDashboard() {
    return this.cache.getOrSet('admin:dashboard', () => this.buildDashboard(), 60);
  }

  private async buildDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalUsers,
      totalDoctors,
      activeDoctors,
      dailyAppointments,
      dailyConsultations,
      completedConsultations,
      cancelledAppointments,
      capturedPayments,
      topSpecializations,
      peakHours,
      patientGrowth,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.doctor.count(),
      this.prisma.doctor.count({ where: { verificationStatus: 'VERIFIED' } }),
      this.prisma.appointment.count({
        where: { createdAt: { gte: today, lt: tomorrow } },
      }),
      this.prisma.consultation.count({
        where: { createdAt: { gte: today, lt: tomorrow } },
      }),
      this.prisma.consultation.count({
        where: { status: ConsultationStatus.COMPLETED, completedAt: { gte: today, lt: tomorrow } },
      }),
      this.prisma.appointment.count({
        where: { status: AppointmentStatus.CANCELLED, cancelledAt: { gte: today, lt: tomorrow } },
      }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.CAPTURED, capturedAt: { gte: today, lt: tomorrow } },
        _sum: { amount: true },
      }),
      this.prisma.doctorSpecialization.groupBy({
        by: ['specializationId'],
        _count: { doctorId: true },
        orderBy: { _count: { doctorId: 'desc' } },
        take: 5,
      }),
      this.prisma.$queryRaw<Array<{ hour: number; count: bigint }>>`
        SELECT EXTRACT(HOUR FROM scheduled_start) as hour, COUNT(*) as count
        FROM appointments
        WHERE scheduled_start >= ${today} AND scheduled_start < ${tomorrow}
        GROUP BY hour
        ORDER BY count DESC
        LIMIT 5
      `,
      this.prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      }),
    ]);

    return {
      totalUsers,
      totalDoctors,
      activeDoctors,
      dailyAppointments,
      dailyConsultations,
      completedConsultations,
      cancelledAppointments,
      revenueSummary: { total: Number(capturedPayments._sum.amount ?? 0), currency: 'INR' },
      topSpecializations,
      peakBookingHours: peakHours.map((h) => ({ hour: Number(h.hour), count: Number(h.count) })),
      patientGrowth,
      averageConsultationTime: null,
    };
  }
}
