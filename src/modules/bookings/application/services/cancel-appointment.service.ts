import { Injectable, Inject, LoggerService, HttpStatus } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@database/prisma.service';
import { AppointmentStatus, BookingHistoryAction } from '@prisma/client';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode, AUDIT_ACTIONS, OUTBOX_EVENTS } from '@common/constants';
import { RequestContext } from '@common/interfaces/api-response.interface';
import { AuditService } from '@modules/audit/application/audit.service';
import { OutboxService } from '@/events/outbox.service';
import { canTransition, AppointmentStatusEnum } from '../../domain/enums/appointment-status.enum';
import { SlotRepository } from '../../infrastructure/persistence/slot.repository';
import { AppointmentRepository } from '../../infrastructure/persistence/appointment.repository';
import { CancelAppointmentDto } from '../dto/appointment.dto';
import { AuthenticatedUser } from './create-booking.service';

@Injectable()
export class CancelAppointmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slotRepository: SlotRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  async execute(
    user: AuthenticatedUser,
    appointmentId: string,
    dto: CancelAppointmentDto,
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

    const isPatient = appointment.patientId === user.id;
    const isDoctor = appointment.doctorId === user.doctorId;

    if (!isPatient && !isDoctor && !user.roles.includes('Admin')) {
      throw new DomainException(ErrorCode.FORBIDDEN, 'Access denied', HttpStatus.FORBIDDEN);
    }

    if (
      !canTransition(appointment.status as AppointmentStatusEnum, AppointmentStatusEnum.CANCELLED)
    ) {
      throw new DomainException(
        ErrorCode.INVALID_APPOINTMENT_STATUS,
        `Cannot cancel appointment in ${appointment.status} status`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const cancellationHours =
      this.configService.get<number>('security.bookingCancellationHours') ?? 24;
    const cutoff = new Date(appointment.scheduledStart);
    cutoff.setHours(cutoff.getHours() - cancellationHours);

    if (new Date() > cutoff && isPatient) {
      throw new DomainException(
        ErrorCode.CANCELLATION_NOT_ALLOWED,
        `Cancellation must be at least ${cancellationHours} hours before appointment`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await this.appointmentRepository.updateStatus(
        appointmentId,
        AppointmentStatus.CANCELLED,
        tx,
        { cancelledAt: new Date(), cancelReason: dto.reason },
      );

      await this.slotRepository.releaseSlot(appointment.slotId, tx);

      await this.appointmentRepository.addHistory(
        {
          appointmentId,
          action: BookingHistoryAction.CANCELLED,
          fromStatus: appointment.status,
          toStatus: AppointmentStatus.CANCELLED,
          fromSlotId: appointment.slotId,
          performedBy: user.id,
          metadata: { reason: dto.reason },
        },
        tx,
      );

      await this.auditService.log(
        {
          userId: user.id,
          action: AUDIT_ACTIONS.APPOINTMENT_CANCELLED,
          resourceType: 'Appointment',
          resourceId: appointmentId,
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
          correlationId: ctx.correlationId,
        },
        tx,
      );

      await this.outboxService.store(
        {
          aggregateType: 'Appointment',
          aggregateId: appointmentId,
          eventType: OUTBOX_EVENTS.APPOINTMENT_CANCELLED,
          payload: {
            appointmentId,
            patientId: appointment.patientId,
            doctorId: appointment.doctorId,
            cancelledBy: user.id,
            reason: dto.reason,
            notification: { patientId: appointment.patientId, doctorId: appointment.doctorId },
            analytics: { eventName: OUTBOX_EVENTS.APPOINTMENT_CANCELLED },
          },
        },
        tx,
      );

      this.logger.log({
        message: 'Appointment cancelled',
        requestId: ctx.requestId,
        appointmentId,
        userId: user.id,
      });

      return { id: appointmentId, status: AppointmentStatus.CANCELLED };
    });
  }
}
