import { Injectable, Inject, LoggerService, HttpStatus } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { PrismaService } from '@database/prisma.service';
import {
  AppointmentStatus,
  BookingHistoryAction,
  SlotStatus,
  UserStatus,
  VerificationStatus,
  Prisma,
} from '@prisma/client';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode, AUDIT_ACTIONS, OUTBOX_EVENTS } from '@common/constants';
import { RequestContext } from '@common/interfaces/api-response.interface';
import { createRequestHash } from '@common/utils/helpers';
import { AuditService } from '@modules/audit/application/audit.service';
import { OutboxService } from '@/events/outbox.service';
import { SlotRepository } from '../../infrastructure/persistence/slot.repository';
import { AppointmentRepository } from '../../infrastructure/persistence/appointment.repository';
import { BookingRepository } from '../../infrastructure/persistence/booking.repository';
import { IdempotencyRepository } from '../../infrastructure/persistence/idempotency.repository';
import { CreateAppointmentDto } from '../dto/appointment.dto';

export interface AuthenticatedUser {
  id: string;
  email: string;
  status: UserStatus;
  roles: string[];
  doctorId?: string;
}

@Injectable()
export class CreateBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slotRepository: SlotRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly bookingRepository: BookingRepository,
    private readonly idempotencyRepository: IdempotencyRepository,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  async execute(
    user: AuthenticatedUser,
    dto: CreateAppointmentDto,
    idempotencyKey: string,
    ctx: RequestContext,
  ) {
    const startTime = Date.now();

    this.logger.log({
      message: 'Booking started',
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      userId: user.id,
      doctorId: dto.doctorId,
      slotId: dto.slotId,
    });

    if (!idempotencyKey?.trim()) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Idempotency-Key header is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const requestPayload = { ...dto, patientId: user.id };

    // Step 1: Check idempotency — return cached response for duplicate requests
    const existingIdempotency = await this.idempotencyRepository.findByKey(idempotencyKey, user.id);

    if (existingIdempotency?.status === 'COMPLETED' && existingIdempotency.responseBody) {
      this.logger.log({
        message: 'Idempotent replay',
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        userId: user.id,
        appointmentId: existingIdempotency.appointmentId,
        latency: Date.now() - startTime,
      });
      return existingIdempotency.responseBody;
    }

    if (existingIdempotency?.status === 'PROCESSING') {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'Booking request is already being processed',
        HttpStatus.CONFLICT,
      );
    }

    if (
      existingIdempotency &&
      existingIdempotency.requestHash !== createRequestHash(requestPayload)
    ) {
      throw new DomainException(
        ErrorCode.IDEMPOTENCY_CONFLICT,
        'Idempotency key reused with different request payload',
        HttpStatus.CONFLICT,
      );
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Register idempotency record inside transaction
        const idempotencyRecord = await this.idempotencyRepository.createProcessing(
          idempotencyKey,
          user.id,
          requestPayload,
          tx,
        );

        // Step 2: Validate patient
        if (user.status !== UserStatus.ACTIVE) {
          throw new DomainException(
            ErrorCode.ACCOUNT_INACTIVE,
            'Account is not active',
            HttpStatus.FORBIDDEN,
          );
        }

        if (!user.roles.includes('Patient')) {
          throw new DomainException(
            ErrorCode.FORBIDDEN,
            'Only patients can book appointments',
            HttpStatus.FORBIDDEN,
          );
        }

        // Step 3: Validate doctor
        const doctor = await tx.doctor.findUnique({
          where: { id: dto.doctorId },
          include: { user: { include: { profile: true } } },
        });

        if (!doctor) {
          throw new DomainException(
            ErrorCode.DOCTOR_NOT_FOUND,
            'Doctor not found',
            HttpStatus.NOT_FOUND,
          );
        }

        if (doctor.verificationStatus !== VerificationStatus.VERIFIED) {
          throw new DomainException(
            ErrorCode.FORBIDDEN,
            'Doctor is not verified for bookings',
            HttpStatus.FORBIDDEN,
          );
        }

        // Step 4: Prevent doctor self-booking
        if (doctor.userId === user.id) {
          throw new DomainException(
            ErrorCode.DOCTOR_SELF_BOOKING,
            'Doctors cannot book their own slots',
            HttpStatus.FORBIDDEN,
          );
        }

        // Step 5: Validate slot
        const slot = await this.slotRepository.findById(dto.slotId, tx);

        if (!slot) {
          throw new DomainException(ErrorCode.NOT_FOUND, 'Slot not found', HttpStatus.NOT_FOUND);
        }

        if (slot.doctorId !== dto.doctorId) {
          throw new DomainException(
            ErrorCode.VALIDATION_ERROR,
            'Slot does not belong to the specified doctor',
            HttpStatus.BAD_REQUEST,
          );
        }

        if (slot.status !== SlotStatus.AVAILABLE) {
          throw new DomainException(
            ErrorCode.SLOT_NOT_AVAILABLE,
            'Slot is not available for booking',
            HttpStatus.CONFLICT,
          );
        }

        if (slot.startTime <= new Date()) {
          throw new DomainException(
            ErrorCode.PAST_APPOINTMENT,
            'Cannot book appointments in the past',
            HttpStatus.BAD_REQUEST,
          );
        }

        // Check doctor leave
        const onLeave = await tx.leave.findFirst({
          where: {
            doctorId: dto.doctorId,
            startDate: { lte: slot.startTime },
            endDate: { gte: slot.startTime },
          },
        });

        if (onLeave) {
          throw new DomainException(
            ErrorCode.SLOT_NOT_AVAILABLE,
            'Doctor is on leave during this slot',
            HttpStatus.CONFLICT,
          );
        }

        // Step 6-7: Reserve slot with optimistic locking
        await this.slotRepository.reserveSlot(
          { slotId: slot.id, expectedVersion: slot.version },
          tx,
        );

        // Step 8: Create appointment
        const appointment = await this.appointmentRepository.create(
          {
            patientId: user.id,
            doctorId: dto.doctorId,
            slotId: slot.id,
            scheduledStart: slot.startTime,
            scheduledEnd: slot.endTime,
            reason: dto.reason,
            notes: dto.notes,
          },
          tx,
        );

        // Create booking record
        await this.bookingRepository.create(
          {
            appointmentId: appointment.id,
            patientId: user.id,
            idempotencyKey,
          },
          tx,
        );

        // Step 9: Booking history
        await this.appointmentRepository.addHistory(
          {
            appointmentId: appointment.id,
            action: BookingHistoryAction.CREATED,
            toStatus: AppointmentStatus.CONFIRMED,
            toSlotId: slot.id,
            performedBy: user.id,
          },
          tx,
        );

        // Step 10: Audit log
        await this.auditService.log(
          {
            userId: user.id,
            action: AUDIT_ACTIONS.APPOINTMENT_BOOKED,
            resourceType: 'Appointment',
            resourceId: appointment.id,
            ipAddress: ctx.ip,
            userAgent: ctx.userAgent,
            correlationId: ctx.correlationId,
            metadata: {
              doctorId: dto.doctorId,
              slotId: slot.id,
              scheduledStart: slot.startTime.toISOString(),
            },
          },
          tx,
        );

        // Step 11: Store outbox event (never publish inside transaction)
        const doctorName = doctor.user.profile
          ? `${doctor.user.profile.firstName} ${doctor.user.profile.lastName}`
          : 'Doctor';

        await this.outboxService.store(
          {
            aggregateType: 'Appointment',
            aggregateId: appointment.id,
            eventType: OUTBOX_EVENTS.APPOINTMENT_BOOKED,
            payload: this.outboxService.buildAppointmentBookedPayload({
              appointmentId: appointment.id,
              patientId: user.id,
              patientEmail: user.email,
              doctorId: dto.doctorId,
              doctorName,
              slotId: slot.id,
              scheduledStart: slot.startTime,
              scheduledEnd: slot.endTime,
              consultationFee: Number(doctor.consultationFee),
            }) as unknown as Prisma.InputJsonValue,
          },
          tx,
        );

        const response = this.mapAppointmentResponse(appointment, slot, doctor);

        // Complete idempotency record
        await this.idempotencyRepository.complete(
          idempotencyRecord.id,
          appointment.id,
          response,
          tx,
        );

        return response;
      });

      this.logger.log({
        message: 'Booking completed',
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        userId: user.id,
        appointmentId: (result as { id: string }).id,
        latency: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      this.logger.error({
        message: 'Booking failed',
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - startTime,
      });

      if (error instanceof DomainException) {
        throw error;
      }

      throw new DomainException(
        ErrorCode.INTERNAL_ERROR,
        'Failed to create booking',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private mapAppointmentResponse(
    appointment: {
      id: string;
      status: AppointmentStatus;
      scheduledStart: Date;
      scheduledEnd: Date;
      reason?: string | null;
    },
    slot: { id: string; startTime: Date; endTime: Date },
    doctor: {
      id: string;
      consultationFee: unknown;
      user: { profile: { firstName: string; lastName: string } | null };
    },
  ) {
    return {
      id: appointment.id,
      status: appointment.status,
      scheduledStart: appointment.scheduledStart,
      scheduledEnd: appointment.scheduledEnd,
      reason: appointment.reason,
      slot: { id: slot.id, startTime: slot.startTime, endTime: slot.endTime },
      doctor: {
        id: doctor.id,
        name: doctor.user.profile
          ? `${doctor.user.profile.firstName} ${doctor.user.profile.lastName}`
          : null,
        consultationFee: Number(doctor.consultationFee),
      },
    };
  }
}
