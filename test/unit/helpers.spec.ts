import {
  createRequestHash,
  hashValue,
  normalizeEmail,
  normalizePhone,
} from '../../src/common/utils/helpers';

describe('helpers', () => {
  it('createRequestHash is deterministic for the same payload', () => {
    const payload = { doctorId: 'd1', slotId: 's1', patientId: 'p1' };
    expect(createRequestHash(payload)).toBe(createRequestHash(payload));
  });

  it('createRequestHash differs when payload changes', () => {
    expect(createRequestHash({ slotId: 'a' })).not.toBe(createRequestHash({ slotId: 'b' }));
  });

  it('hashValue returns 64-char SHA-256 hex', () => {
    expect(hashValue('refresh-token')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('normalizeEmail trims and lowercases', () => {
    expect(normalizeEmail('  Patient@Amrutam.TEST ')).toBe('patient@amrutam.test');
  });

  it('normalizePhone strips spaces and leading plus', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('919876543210');
  });
});
