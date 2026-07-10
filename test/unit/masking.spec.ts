import { sanitizeForLog } from '../../src/common/utils/masking.util';

describe('Log masking', () => {
  it('redacts sensitive medical fields', () => {
    const result = sanitizeForLog({
      diagnosis: 'Hypertension',
      doctorNotes: 'Patient anxious',
      userId: 'uuid-123',
    });
    expect(result.diagnosis).toBe('[REDACTED]');
    expect(result.doctorNotes).toBe('[REDACTED]');
    expect(result.userId).toBe('uuid-123');
  });

  it('redacts nested sensitive fields', () => {
    const result = sanitizeForLog({
      metadata: { password: 'secret', appointmentId: 'a1' },
    });
    expect((result.metadata as Record<string, unknown>).password).toBe('[REDACTED]');
  });
});
