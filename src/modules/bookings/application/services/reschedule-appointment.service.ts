import { Injectable, Inject, LoggerService, HttpStatus } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { PrismaService } from '@database/prisma.service';
import { AppointmentStatus, BookingHistoryAction, SlotStatus } from '@prisma/client';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode, AUDIT_ACTIONS, OUTBOX_EVENTS } from '@common/constants';
import { RequestContext } from '@common/interfaces/api-response.interface';
import { AuditService } from '@modules/audit/application/audit.service';
import { OutboxService } from '@/events/outbox.service';
import { canTransition, AppointmentStatusEnum } from '../../domain/enums/appointment-status.enum';
import { SlotRepository } from '../../infrastructure/persistence/slot.repository';
import { AppointmentRepository } from '../../infrastructure/persistence/appointment.repository';
import { RescheduleAppointmentDto } from '../dto/appointment.dto';
import { AuthenticatedUser } from './create-booking.service';

@Injectable()
export class RescheduleAppointmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slotRepository: SlotRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  async execute(
    user: AuthenticatedUser,
    appointmentId: string,
    dto: RescheduleAppointmentDto,
    ctx: RequestContext,
  ) {
    const appointment = await this.appointmentRepository.findById(appointmentId);

    if (!appointment) {
      throw new DomainException(
        ErrorCode.APPOINTMENT_NOT_FOUND,
        'Appointment not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (appointment.patientId !== user.id && !user.roles.includes('Admin')) {
      throw new DomainException(ErrorCode.FORBIDDEN, 'Access denied', HttpStatus.FORBIDDEN);
    }

    if (
      !canTransition(
        appointment.status as AppointmentStatusEnum,
        AppointmentStatusEnum.RESCHEDULED,
      ) &&
      appointment.status !== AppointmentStatus.CONFIRMED
    ) {
      throw new DomainException(
        ErrorCode.RESCHEDULE_NOT_ALLOWED,
        `Cannot reschedule appointment in ${appointment.status} status`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const newSlot = await this.slotRepository.findById(dto.newSlotId);

    if (!newSlot) {
      throw new DomainException(ErrorCode.NOT_FOUND, 'New slot not found', HttpStatus.NOT_FOUND);
    }

    if (newSlot.doctorId !== appointment.doctorId) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'New slot must belong to the same doctor',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (newSlot.status !== SlotStatus.AVAILABLE) {
      throw new DomainException(
        ErrorCode.SLOT_NOT_AVAILABLE,
        'New slot is not available',
        HttpStatus.CONFLICT,
      );
    }

    if (newSlot.startTime <= new Date()) {
      throw new DomainException(
        ErrorCode.PAST_APPOINTMENT,
        'Cannot reschedule to a past slot',
        HttpStatus.BAD_REQUEST,
      );
    }

    const previousSlotId = appointment.slotId;

    return this.prisma.$transaction(async (tx) => {
      // Reserve new slot first, then release old — prevents orphan double-booking
      await this.slotRepository.reserveSlot(
        { slotId: newSlot.id, expectedVersion: newSlot.version },
        tx,
      );

      await this.slotRepository.releaseSlot(previousSlotId, tx);

      const updated = await this.appointmentRepository.reschedule(
        appointmentId,
        newSlot.id,
        newSlot.startTime,
        newSlot.endTime,
        tx,
      );

      await this.appointmentRepository.addHistory(
        {
          appointmentId,
          action: BookingHistoryAction.RESCHEDULED,
          fromStatus: appointment.status,
          toStatus: AppointmentStatus.CONFIRMED,
          fromSlotId: previousSlotId,
          toSlotId: newSlot.id,
          performedBy: user.id,
          metadata: { reason: dto.reason },
        },
        tx,
      );

      await this.auditService.log(
        {
          userId: user.id,
          action: AUDIT_ACTIONS.APPOINTMENT_RESCHEDULED,
          resourceType: 'Appointment',
          resourceId: appointmentId,
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
          correlationId: ctx.correlationId,
          metadata: {
            fromSlotId: previousSlotId,
            toSlotId: newSlot.id,
          },
        },
        tx,
      );

      await this.outboxService.store(
        {
          aggregateType: 'Appointment',
          aggregateId: appointmentId,
          eventType: OUTBOX_EVENTS.APPOINTMENT_RESCHEDULED,
          payload: {
            appointmentId,
            patientId: appointment.patientId,
            doctorId: appointment.doctorId,
            previousSlotId,
            newSlotId: newSlot.id,
            scheduledStart: newSlot.startTime.toISOString(),
            scheduledEnd: newSlot.endTime.toISOString(),
            notification: { patientId: appointment.patientId, doctorId: appointment.doctorId },
            analytics: { eventName: OUTBOX_EVENTS.APPOINTMENT_RESCHEDULED },
          },
        },
        tx,
      );

      this.logger.log({
        message: 'Appointment rescheduled',
        requestId: ctx.requestId,
        appointmentId,
        userId: user.id,
      });

      return {
        id: updated.id,
        status: updated.status,
        scheduledStart: updated.scheduledStart,
        scheduledEnd: updated.scheduledEnd,
        slot: { id: newSlot.id, startTime: newSlot.startTime, endTime: newSlot.endTime },
      };
    });
  }
}
