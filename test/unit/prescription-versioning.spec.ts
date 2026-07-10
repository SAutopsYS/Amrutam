import { PrescriptionRepository } from '../../src/modules/prescriptions/infrastructure/persistence/prescription.repository';

describe('Prescription immutability design', () => {
  it('repository exposes createNewVersion for immutable updates', () => {
    const repo = new PrescriptionRepository({} as never);
    expect(typeof repo.createNewVersion).toBe('function');
    expect(typeof repo.getVersionHistory).toBe('function');
  });
});
