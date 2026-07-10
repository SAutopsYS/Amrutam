import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { TransactionClient } from '@database/transaction.client';
import { ConsultationStatus, TimelineEventType, Prisma, AppointmentStatus } from '@prisma/client';

export interface ConsultationFilters {
  patientId?: string;
  doctorId?: string;
  status?: ConsultationStatus;
  fromDate?: Date;
  toDate?: Date;
  keyword?: string;
  cursor?: string;
  limit?: number;
}

@Injectable()
export class ConsultationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string, tx?: TransactionClient) {
    const client = tx ?? this.prisma;
    return client.consultation.findUnique({
      where: { id },
      include: {
        appointment: true,
        clinicalNotes: { where: { isCurrent: true }, take: 1 },
        prescriptions: {
          where: { status: { not: 'CANCELLED' } },
          include: {
            versions: {
              orderBy: { version: 'desc' },
              take: 1,
              include: { items: true },
            },
          },
        },
        timeline: { orderBy: { createdAt: 'desc' }, take: 20 },
        patient: { include: { profile: true } },
        doctor: { include: { user: { include: { profile: true } } } },
      },
    });
  }

  findByAppointmentId(appointmentId: string) {
    return this.prisma.consultation.findUnique({ where: { appointmentId } });
  }

  async createFromAppointment(
    data: { appointmentId: string; patientId: string; doctorId: string },
    tx: TransactionClient,
  ) {
    return tx.consultation.create({
      data: {
        ...data,
        status: ConsultationStatus.SCHEDULED,
        timeline: {
          create: {
            eventType: TimelineEventType.CREATED,
            description: 'Consultation scheduled from appointment',
          },
        },
      },
    });
  }

  async updateStatus(
    id: string,
    status: ConsultationStatus,
    tx: TransactionClient,
    extra?: Partial<Prisma.ConsultationUpdateInput>,
  ) {
    const current = await tx.consultation.findUniqueOrThrow({ where: { id } });
    return tx.consultation.update({
      where: { id, version: current.version },
      data: { status, version: { increment: 1 }, ...extra },
    });
  }

  async addTimelineEvent(
    data: {
      consultationId: string;
      eventType: TimelineEventType;
      description?: string;
      performedBy?: string;
      metadata?: Record<string, unknown>;
    },
    tx: TransactionClient,
  ) {
    return tx.consultationTimeline.create({
      data: {
        consultationId: data.consultationId,
        eventType: data.eventType,
        description: data.description,
        performedBy: data.performedBy,
        metadata: data.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async findMany(filters: ConsultationFilters) {
    const limit = Math.min(filters.limit ?? 20, 100);
    const where: Prisma.ConsultationWhereInput = {};

    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.doctorId) where.doctorId = filters.doctorId;
    if (filters.status) where.status = filters.status;
    if (filters.fromDate || filters.toDate) {
      where.createdAt = {};
      if (filters.fromDate) where.createdAt.gte = filters.fromDate;
      if (filters.toDate) where.createdAt.lte = filters.toDate;
    }
    if (filters.keyword) {
      where.OR = [
        {
          clinicalNotes: {
            some: { diagnosis: { contains: filters.keyword, mode: 'insensitive' } },
          },
        },
        {
          clinicalNotes: {
            some: { chiefComplaint: { contains: filters.keyword, mode: 'insensitive' } },
          },
        },
      ];
    }

    const query: Prisma.ConsultationFindManyArgs = {
      where,
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        appointment: { select: { scheduledStart: true, scheduledEnd: true } },
        patient: {
          select: {
            id: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        },
        doctor: {
          select: {
            id: true,
            user: { select: { profile: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    };

    if (filters.cursor) {
      query.cursor = { id: filters.cursor };
      query.skip = 1;
    }

    const items = await this.prisma.consultation.findMany(query);
    const hasMore = items.length > limit;
    return {
      items: hasMore ? items.slice(0, limit) : items,
      hasMore,
      nextCursor: hasMore ? items[limit - 1]?.id : undefined,
    };
  }

  async ensureForAppointment(appointmentId: string, tx?: TransactionClient) {
    const client = tx ?? this.prisma;
    const existing = await client.consultation.findUnique({ where: { appointmentId } });
    if (existing) return existing;

    const appointment = await client.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
    });

    if (
      appointment.status !== AppointmentStatus.CONFIRMED &&
      appointment.status !== AppointmentStatus.COMPLETED
    ) {
      return null;
    }

    if (tx) {
      return this.createFromAppointment(
        { appointmentId, patientId: appointment.patientId, doctorId: appointment.doctorId },
        tx,
      );
    }

    return this.prisma.$transaction((innerTx) =>
      this.createFromAppointment(
        { appointmentId, patientId: appointment.patientId, doctorId: appointment.doctorId },
        innerTx,
      ),
    );
  }
}
