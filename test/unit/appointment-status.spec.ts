import {
  canTransition,
  AppointmentStatusEnum,
} from '../../src/modules/bookings/domain/enums/appointment-status.enum';

describe('AppointmentStatus transitions', () => {
  it('allows CONFIRMED → CANCELLED', () => {
    expect(canTransition(AppointmentStatusEnum.CONFIRMED, AppointmentStatusEnum.CANCELLED)).toBe(
      true,
    );
  });

  it('allows CONFIRMED → RESCHEDULED', () => {
    expect(canTransition(AppointmentStatusEnum.CONFIRMED, AppointmentStatusEnum.RESCHEDULED)).toBe(
      true,
    );
  });

  it('denies CANCELLED → CONFIRMED', () => {
    expect(canTransition(AppointmentStatusEnum.CANCELLED, AppointmentStatusEnum.CONFIRMED)).toBe(
      false,
    );
  });

  it('denies COMPLETED → any transition', () => {
    expect(canTransition(AppointmentStatusEnum.COMPLETED, AppointmentStatusEnum.CANCELLED)).toBe(
      false,
    );
  });
});
