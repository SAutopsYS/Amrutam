import { Injectable } from '@nestjs/common';
import { TransactionClient } from '@database/transaction.client';
import { OutboxEventStatus, Prisma } from '@prisma/client';
import { OUTBOX_EVENTS } from '@common/constants';

export interface OutboxEventInput {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
}

export interface AppointmentBookedPayload {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  slotId: string;
  scheduledStart: string;
  scheduledEnd: string;
  notification: { patientEmail: string; doctorName: string };
  analytics: { eventName: string; doctorId: string; fee: number };
  billing: { appointmentId: string; amount: number; currency: string };
  videoConsultation: { appointmentId: string; scheduledStart: string };
}

@Injectable()
export class OutboxService {
  async store(input: OutboxEventInput, tx: TransactionClient): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: input.payload,
        status: OutboxEventStatus.PENDING,
      },
    });
  }

  buildAppointmentBookedPayload(params: {
    appointmentId: string;
    patientId: string;
    patientEmail: string;
    doctorId: string;
    doctorName: string;
    slotId: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    consultationFee: number;
  }): AppointmentBookedPayload {
    return {
      appointmentId: params.appointmentId,
      patientId: params.patientId,
      doctorId: params.doctorId,
      slotId: params.slotId,
      scheduledStart: params.scheduledStart.toISOString(),
      scheduledEnd: params.scheduledEnd.toISOString(),
      notification: {
        patientEmail: params.patientEmail,
        doctorName: params.doctorName,
      },
      analytics: {
        eventName: OUTBOX_EVENTS.APPOINTMENT_BOOKED,
        doctorId: params.doctorId,
        fee: params.consultationFee,
      },
      billing: {
        appointmentId: params.appointmentId,
        amount: params.consultationFee,
        currency: 'INR',
      },
      videoConsultation: {
        appointmentId: params.appointmentId,
        scheduledStart: params.scheduledStart.toISOString(),
      },
    };
  }
}
