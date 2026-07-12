import {
  encryptSecret,
  decryptSecret,
  hashRecoveryCode,
  generateRecoveryCodes,
} from '../../src/modules/auth/infrastructure/mfa-crypto.util';

describe('mfa-crypto', () => {
  const key = 'test-mfa-encryption-key-min-32-characters!!';

  it('round-trips AES-256-GCM encryption', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const encrypted = encryptSecret(secret, key);
    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted, key)).toBe(secret);
  });

  it('produces different ciphertext for same plaintext (random IV)', () => {
    const a = encryptSecret('SAMESECRETVALUE12345', key);
    const b = encryptSecret('SAMESECRETVALUE12345', key);
    expect(a).not.toBe(b);
  });

  it('hashes recovery codes case-insensitively', () => {
    expect(hashRecoveryCode('abcde-fghij')).toBe(hashRecoveryCode('ABCDE-FGHIJ'));
  });

  it('generates unique recovery codes', () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[A-F0-9]{5}-[A-F0-9]{5}$/);
  });
});
