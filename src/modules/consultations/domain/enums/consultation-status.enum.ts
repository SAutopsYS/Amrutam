export enum ConsultationStatusEnum {
  SCHEDULED = 'SCHEDULED',
  CHECKED_IN = 'CHECKED_IN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export const CONSULTATION_TRANSITIONS: Record<ConsultationStatusEnum, ConsultationStatusEnum[]> = {
  [ConsultationStatusEnum.SCHEDULED]: [
    ConsultationStatusEnum.CHECKED_IN,
    ConsultationStatusEnum.IN_PROGRESS,
    ConsultationStatusEnum.CANCELLED,
    ConsultationStatusEnum.NO_SHOW,
  ],
  [ConsultationStatusEnum.CHECKED_IN]: [
    ConsultationStatusEnum.IN_PROGRESS,
    ConsultationStatusEnum.CANCELLED,
    ConsultationStatusEnum.NO_SHOW,
  ],
  [ConsultationStatusEnum.IN_PROGRESS]: [ConsultationStatusEnum.COMPLETED],
  [ConsultationStatusEnum.COMPLETED]: [],
  [ConsultationStatusEnum.CANCELLED]: [],
  [ConsultationStatusEnum.NO_SHOW]: [],
};

export function canConsultationTransition(
  from: ConsultationStatusEnum,
  to: ConsultationStatusEnum,
): boolean {
  return CONSULTATION_TRANSITIONS[from]?.includes(to) ?? false;
}
