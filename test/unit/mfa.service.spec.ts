jest.mock('otplib', () => ({
  generateSecret: jest.fn(() => 'JBSWY3DPEHPK3PXP'),
  generateURI: jest.fn(() => 'otpauth://totp/Amrutam:user%40test.com?secret=JBSWY3DPEHPK3PXP'),
  verify: jest.fn(async () => ({ valid: true, delta: 0 })),
  generateSync: jest.fn(() => '123456'),
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn(async () => 'data:image/png;base64,TESTQR'),
}));

import { MfaService } from '../../src/modules/auth/application/services/mfa.service';
import { ErrorCode } from '../../src/common/constants';
import { encryptSecret } from '../../src/modules/auth/infrastructure/mfa-crypto.util';
import { verify } from 'otplib';

describe('MfaService', () => {
  const key = 'unit-test-mfa-encryption-key-32chars!!';
  const prisma = {
    user: {
      findUniqueOrThrow: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const jwtService = {
    sign: jest.fn().mockReturnValue('mfa.jwt.token'),
    verify: jest.fn(),
  };
  const configService = {
    get: jest.fn((k: string) => {
      if (k === 'security.mfaEnabled') return true;
      if (k === 'security.mfaEncryptionKey') return key;
      if (k === 'jwt.accessSecret') return key;
      return undefined;
    }),
  };
  const auditService = { log: jest.fn() };
  const ctx = { requestId: 'r1', correlationId: 'c1', ip: '127.0.0.1' };

  let service: MfaService;

  beforeEach(() => {
    jest.clearAllMocks();
    (verify as jest.Mock).mockResolvedValue({ valid: true, delta: 0 });
    service = new MfaService(
      prisma as never,
      jwtService as never,
      configService as never,
      auditService as never,
    );
  });

  it('beginSetup stores pending encrypted secret and returns QR payload', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', mfaEnabled: false });
    prisma.user.update.mockResolvedValue({});

    const result = await service.beginSetup('u1', 'user@test.com', ctx as never);

    expect(result.secret).toBe('JBSWY3DPEHPK3PXP');
    expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.recoveryCodes).toHaveLength(10);
    expect(prisma.user.update).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalled();
  });

  it('beginSetup rejects when MFA already enabled', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', mfaEnabled: true });
    await expect(service.beginSetup('u1', 'user@test.com', ctx as never)).rejects.toMatchObject({
      code: ErrorCode.MFA_ALREADY_ENABLED,
    });
  });

  it('verifySetup enables MFA when OTP is valid', async () => {
    const encrypted = encryptSecret('JBSWY3DPEHPK3PXP', key);
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'u1',
      mfaEnabled: false,
      mfaPendingSecret: encrypted,
    });
    prisma.user.update.mockResolvedValue({});

    const result = await service.verifySetup('u1', { otp: '123456' }, ctx as never);
    expect(result.mfaEnabled).toBe(true);
  });

  it('completeChallenge issues identity after valid OTP', async () => {
    const encrypted = encryptSecret('JBSWY3DPEHPK3PXP', key);
    jwtService.verify.mockReturnValue({ sub: 'u1', email: 'u@test.com', purpose: 'mfa' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'u@test.com',
      mfaEnabled: true,
      mfaSecret: encrypted,
      mfaRecoveryCodes: [],
      roles: [{ role: { name: 'Patient' } }],
    });

    const identity = await service.completeChallenge(
      { mfaToken: 'tok', otp: '123456' },
      ctx as never,
    );
    expect(identity.userId).toBe('u1');
    expect(identity.roles).toContain('Patient');
  });
});
