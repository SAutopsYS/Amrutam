import {
  canConsultationTransition,
  ConsultationStatusEnum,
} from '../../src/modules/consultations/domain/enums/consultation-status.enum';

describe('Consultation status transitions', () => {
  it('allows valid doctor workflow transitions', () => {
    expect(
      canConsultationTransition(
        ConsultationStatusEnum.SCHEDULED,
        ConsultationStatusEnum.IN_PROGRESS,
      ),
    ).toBe(true);
    expect(
      canConsultationTransition(
        ConsultationStatusEnum.IN_PROGRESS,
        ConsultationStatusEnum.COMPLETED,
      ),
    ).toBe(true);
  });

  it('rejects invalid transitions from terminal states', () => {
    expect(
      canConsultationTransition(ConsultationStatusEnum.COMPLETED, ConsultationStatusEnum.CANCELLED),
    ).toBe(false);
  });
});
