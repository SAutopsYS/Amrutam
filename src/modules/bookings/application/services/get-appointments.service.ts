import { Injectable, HttpStatus } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode } from '@common/constants';
import { AppointmentRepository } from '../../infrastructure/persistence/appointment.repository';
import { AuthenticatedUser } from './create-booking.service';
import { ListAppointmentsQueryDto } from '../dto/appointment.dto';

@Injectable()
export class GetAppointmentsService {
  constructor(private readonly appointmentRepository: AppointmentRepository) {}

  async getById(user: AuthenticatedUser, appointmentId: string) {
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
    const isAdmin = user.roles.includes('Admin') || user.roles.includes('Super Admin');

    if (!isPatient && !isDoctor && !isAdmin) {
      throw new DomainException(ErrorCode.FORBIDDEN, 'Access denied', HttpStatus.FORBIDDEN);
    }

    return this.mapAppointment(appointment);
  }

  async getPatientAppointments(user: AuthenticatedUser, query: ListAppointmentsQueryDto) {
    const result = await this.appointmentRepository.findMany({
      patientId: user.id,
      status: query.status as AppointmentStatus | undefined,
      cursor: query.cursor,
      limit: query.limit ? Number(query.limit) : 20,
    });

    return {
      data: result.items.map((a) => this.mapAppointment(a)),
      meta: { hasMore: result.hasMore, nextCursor: result.nextCursor },
    };
  }

  async getDoctorAppointments(user: AuthenticatedUser, query: ListAppointmentsQueryDto) {
    if (!user.doctorId) {
      throw new DomainException(ErrorCode.FORBIDDEN, 'User is not a doctor', HttpStatus.FORBIDDEN);
    }

    const result = await this.appointmentRepository.findMany({
      doctorId: user.doctorId,
      status: query.status as AppointmentStatus | undefined,
      cursor: query.cursor,
      limit: query.limit ? Number(query.limit) : 20,
    });

    return {
      data: result.items.map((a) => this.mapAppointment(a)),
      meta: { hasMore: result.hasMore, nextCursor: result.nextCursor },
    };
  }

  private mapAppointment(appointment: {
    id: string;
    status: AppointmentStatus;
    scheduledStart: Date;
    scheduledEnd: Date;
    reason?: string | null;
    cancelReason?: string | null;
    slot?: { id: string; startTime: Date; endTime: Date; status: string };
    doctor?: { id: string; user: { profile: { firstName: string; lastName: string } | null } };
    patient?: { id: string; profile: { firstName: string; lastName: string } | null };
  }) {
    return {
      id: appointment.id,
      status: appointment.status,
      scheduledStart: appointment.scheduledStart,
      scheduledEnd: appointment.scheduledEnd,
      reason: appointment.reason,
      cancelReason: appointment.cancelReason,
      slot: appointment.slot,
      doctor: appointment.doctor
        ? {
            id: appointment.doctor.id,
            name: appointment.doctor.user.profile
              ? `${appointment.doctor.user.profile.firstName} ${appointment.doctor.user.profile.lastName}`
              : null,
          }
        : undefined,
      patient: appointment.patient
        ? {
            id: appointment.patient.id,
            name: appointment.patient.profile
              ? `${appointment.patient.profile.firstName} ${appointment.patient.profile.lastName}`
              : null,
          }
        : undefined,
    };
  }
}
