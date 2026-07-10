export enum AppointmentStatusEnum {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
  RESCHEDULED = 'RESCHEDULED',
}

/** Allowed status transitions — enforced at domain layer, not in controllers. */
export const APPOINTMENT_STATUS_TRANSITIONS: Record<
  AppointmentStatusEnum,
  AppointmentStatusEnum[]
> = {
  [AppointmentStatusEnum.PENDING]: [
    AppointmentStatusEnum.CONFIRMED,
    AppointmentStatusEnum.CANCELLED,
  ],
  [AppointmentStatusEnum.CONFIRMED]: [
    AppointmentStatusEnum.COMPLETED,
    AppointmentStatusEnum.CANCELLED,
    AppointmentStatusEnum.NO_SHOW,
    AppointmentStatusEnum.RESCHEDULED,
  ],
  [AppointmentStatusEnum.COMPLETED]: [],
  [AppointmentStatusEnum.CANCELLED]: [],
  [AppointmentStatusEnum.NO_SHOW]: [],
  [AppointmentStatusEnum.RESCHEDULED]: [],
};

export function canTransition(from: AppointmentStatusEnum, to: AppointmentStatusEnum): boolean {
  return APPOINTMENT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
