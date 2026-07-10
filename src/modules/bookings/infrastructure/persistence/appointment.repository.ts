import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { TransactionClient } from '@database/transaction.client';
import { Appointment, AppointmentStatus, BookingHistoryAction, Prisma } from '@prisma/client';

export interface CreateAppointmentInput {
  patientId: string;
  doctorId: string;
  slotId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  reason?: string;
  notes?: string;
}

export interface AppointmentFilters {
  patientId?: string;
  doctorId?: string;
  status?: AppointmentStatus;
  cursor?: string;
  limit?: number;
}

@Injectable()
export class AppointmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string, tx?: TransactionClient) {
    const client = tx ?? this.prisma;
    return client.appointment.findUnique({
      where: { id },
      include: {
        slot: true,
        booking: true,
        doctor: { include: { user: { include: { profile: true } } } },
        patient: { include: { profile: true } },
      },
    });
  }

  async create(input: CreateAppointmentInput, tx: TransactionClient): Promise<Appointment> {
    return tx.appointment.create({
      data: {
        patientId: input.patientId,
        doctorId: input.doctorId,
        slotId: input.slotId,
        scheduledStart: input.scheduledStart,
        scheduledEnd: input.scheduledEnd,
        reason: input.reason,
        notes: input.notes,
        status: AppointmentStatus.CONFIRMED,
      },
    });
  }

  async updateStatus(
    id: string,
    status: AppointmentStatus,
    tx: TransactionClient,
    extra?: Partial<Prisma.AppointmentUpdateInput>,
  ): Promise<Appointment> {
    const current = await tx.appointment.findUniqueOrThrow({ where: { id } });

    return tx.appointment.update({
      where: { id, version: current.version },
      data: {
        status,
        version: { increment: 1 },
        ...extra,
      },
    });
  }

  async reschedule(
    id: string,
    newSlotId: string,
    scheduledStart: Date,
    scheduledEnd: Date,
    tx: TransactionClient,
  ): Promise<Appointment> {
    const current = await tx.appointment.findUniqueOrThrow({ where: { id } });

    return tx.appointment.update({
      where: { id, version: current.version },
      data: {
        slotId: newSlotId,
        scheduledStart,
        scheduledEnd,
        status: AppointmentStatus.CONFIRMED,
        rescheduledFrom: id,
        version: { increment: 1 },
      },
    });
  }

  async addHistory(
    data: {
      appointmentId: string;
      action: BookingHistoryAction;
      fromStatus?: AppointmentStatus;
      toStatus?: AppointmentStatus;
      fromSlotId?: string;
      toSlotId?: string;
      performedBy?: string;
      metadata?: Record<string, unknown>;
    },
    tx: TransactionClient,
  ) {
    return tx.bookingHistory.create({
      data: {
        appointmentId: data.appointmentId,
        action: data.action,
        fromStatus: data.fromStatus,
        toStatus: data.toStatus,
        fromSlotId: data.fromSlotId,
        toSlotId: data.toSlotId,
        performedBy: data.performedBy,
        metadata: data.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async findMany(filters: AppointmentFilters) {
    const limit = Math.min(filters.limit ?? 20, 100);
    const where: Prisma.AppointmentWhereInput = {};

    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.doctorId) where.doctorId = filters.doctorId;
    if (filters.status) where.status = filters.status;

    const query: Prisma.AppointmentFindManyArgs = {
      where,
      take: limit + 1,
      orderBy: { scheduledStart: 'desc' },
      select: {
        id: true,
        status: true,
        scheduledStart: true,
        scheduledEnd: true,
        reason: true,
        cancelReason: true,
        slot: { select: { id: true, startTime: true, endTime: true, status: true } },
        doctor: {
          select: {
            id: true,
            user: { select: { profile: { select: { firstName: true, lastName: true } } } },
          },
        },
        patient: {
          select: {
            id: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    };

    if (filters.cursor) {
      query.cursor = { id: filters.cursor };
      query.skip = 1;
    }

    const appointments = await this.prisma.appointment.findMany(query);

    const hasMore = appointments.length > limit;
    const items = hasMore ? appointments.slice(0, limit) : appointments;

    return {
      items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
    };
  }
}
