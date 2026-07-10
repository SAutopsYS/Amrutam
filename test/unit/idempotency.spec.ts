import { createRequestHash } from '../../src/common/utils/helpers';

describe('Idempotency helpers', () => {
  it('produces consistent hash for same payload', () => {
    const payload = { doctorId: 'd1', slotId: 's1', patientId: 'p1' };
    expect(createRequestHash(payload)).toBe(createRequestHash(payload));
  });

  it('produces different hash for different payloads', () => {
    const a = createRequestHash({ doctorId: 'd1', slotId: 's1' });
    const b = createRequestHash({ doctorId: 'd1', slotId: 's2' });
    expect(a).not.toBe(b);
  });
});
