import { Module } from '@nestjs/common';
import { AppointmentsController } from './presentation/appointments.controller';
import { CreateBookingService } from './application/services/create-booking.service';
import { CancelAppointmentService } from './application/services/cancel-appointment.service';
import { RescheduleAppointmentService } from './application/services/reschedule-appointment.service';
import { GetAppointmentsService } from './application/services/get-appointments.service';
import { SlotRepository } from './infrastructure/persistence/slot.repository';
import { AppointmentRepository } from './infrastructure/persistence/appointment.repository';
import { BookingRepository } from './infrastructure/persistence/booking.repository';
import { IdempotencyRepository } from './infrastructure/persistence/idempotency.repository';

@Module({
  controllers: [AppointmentsController],
  providers: [
    CreateBookingService,
    CancelAppointmentService,
    RescheduleAppointmentService,
    GetAppointmentsService,
    SlotRepository,
    AppointmentRepository,
    BookingRepository,
    IdempotencyRepository,
  ],
  exports: [AppointmentRepository, SlotRepository, CreateBookingService],
})
export class BookingsModule {}
