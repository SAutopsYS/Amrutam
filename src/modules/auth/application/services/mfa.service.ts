import { Injectable, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as QRCode from 'qrcode';
import { generateSecret, generateURI, verify } from 'otplib';
import { PrismaService } from '@database/prisma.service';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode, AUDIT_ACTIONS } from '@common/constants';
import { AuditService } from '@modules/audit/application/audit.service';
import { RequestContext } from '@common/interfaces/api-response.interface';
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
} from '../../infrastructure/mfa-crypto.util';
import { DisableMfaDto, MfaChallengeDto, VerifyMfaSetupDto } from '../dto/auth.dto';

type MfaUser = {
  id: string;
  mfaSecret: string | null;
  mfaRecoveryCodes: unknown;
};

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  private encryptionKey(): string {
    return (
      this.configService.get<string>('security.mfaEncryptionKey') ||
      this.configService.get<string>('jwt.accessSecret') ||
      ''
    );
  }

  private assertFeatureEnabled(): void {
    if (!this.configService.get<boolean>('security.mfaEnabled')) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'MFA is disabled for this environment (set MFA_ENABLED=true)',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  async beginSetup(userId: string, email: string, ctx: RequestContext) {
    this.assertFeatureEnabled();

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaEnabled) {
      throw new DomainException(
        ErrorCode.MFA_ALREADY_ENABLED,
        'MFA is already enabled',
        HttpStatus.CONFLICT,
      );
    }

    const secret = generateSecret();
    const recoveryCodes = generateRecoveryCodes(10);
    const encrypted = encryptSecret(secret, this.encryptionKey());

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaPendingSecret: encrypted,
        mfaRecoveryCodes: recoveryCodes.map(hashRecoveryCode),
      },
    });

    const otpauthUrl = generateURI({
      issuer: 'Amrutam',
      label: email,
      secret,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    await this.auditService.log({
      userId,
      action: AUDIT_ACTIONS.MFA_SETUP_STARTED,
      resourceType: 'user',
      resourceId: userId,
      ipAddress: ctx.ip,
      correlationId: ctx.correlationId,
      requestId: ctx.requestId,
    });

    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl,
      recoveryCodes,
      message: 'Scan the QR code, then confirm with POST /auth/mfa/verify-setup',
    };
  }

  async verifySetup(userId: string, dto: VerifyMfaSetupDto, ctx: RequestContext) {
    this.assertFeatureEnabled();

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaEnabled) {
      throw new DomainException(
        ErrorCode.MFA_ALREADY_ENABLED,
        'MFA is already enabled',
        HttpStatus.CONFLICT,
      );
    }
    if (!user.mfaPendingSecret) {
      throw new DomainException(
        ErrorCode.MFA_NOT_CONFIGURED,
        'Call POST /auth/mfa/enable first',
        HttpStatus.BAD_REQUEST,
      );
    }

    const secret = decryptSecret(user.mfaPendingSecret, this.encryptionKey());
    const result = await verify({ secret, token: dto.otp });
    if (!result.valid) {
      throw new DomainException(ErrorCode.MFA_INVALID, 'Invalid OTP code', HttpStatus.UNAUTHORIZED);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaSecret: user.mfaPendingSecret,
        mfaPendingSecret: null,
      },
    });

    await this.auditService.log({
      userId,
      action: AUDIT_ACTIONS.MFA_ENABLED,
      resourceType: 'user',
      resourceId: userId,
      ipAddress: ctx.ip,
      correlationId: ctx.correlationId,
      requestId: ctx.requestId,
    });

    return { mfaEnabled: true };
  }

  async disable(userId: string, dto: DisableMfaDto, ctx: RequestContext) {
    this.assertFeatureEnabled();

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new DomainException(
        ErrorCode.MFA_NOT_ENABLED,
        'MFA is not enabled',
        HttpStatus.BAD_REQUEST,
      );
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      throw new DomainException(
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!dto.otp && !dto.recoveryCode) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Provide otp or recoveryCode',
        HttpStatus.BAD_REQUEST,
      );
    }

    const ok = await this.verifyOtpOrRecovery(user, dto.otp, dto.recoveryCode);
    if (!ok) {
      throw new DomainException(
        ErrorCode.MFA_INVALID,
        'Invalid OTP or recovery code',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaPendingSecret: null,
        mfaRecoveryCodes: [],
      },
    });

    await this.auditService.log({
      userId,
      action: AUDIT_ACTIONS.MFA_DISABLED,
      resourceType: 'user',
      resourceId: userId,
      ipAddress: ctx.ip,
      correlationId: ctx.correlationId,
      requestId: ctx.requestId,
    });

    return { mfaEnabled: false };
  }

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mfaEnabled: true, mfaPendingSecret: true },
    });
    return {
      mfaEnabled: user.mfaEnabled,
      setupInProgress: Boolean(user.mfaPendingSecret) && !user.mfaEnabled,
      featureEnabled: this.configService.get<boolean>('security.mfaEnabled') === true,
    };
  }

  issueChallengeToken(userId: string, email: string): string {
    return this.jwtService.sign(
      { sub: userId, email, purpose: 'mfa' },
      {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: '5m',
      },
    );
  }

  async completeChallenge(
    dto: MfaChallengeDto,
    ctx: RequestContext,
  ): Promise<{ userId: string; email: string; roles: string[] }> {
    this.assertFeatureEnabled();

    if (!dto.otp && !dto.recoveryCode) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Provide otp or recoveryCode',
        HttpStatus.BAD_REQUEST,
      );
    }

    let payload: { sub: string; email: string; purpose?: string };
    try {
      payload = this.jwtService.verify(dto.mfaToken, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Invalid or expired MFA token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (payload.purpose !== 'mfa') {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Invalid MFA challenge token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: true } } },
    });

    if (!user?.mfaEnabled || !user.mfaSecret) {
      throw new DomainException(
        ErrorCode.MFA_NOT_ENABLED,
        'MFA is not enabled for this account',
        HttpStatus.BAD_REQUEST,
      );
    }

    const ok = await this.verifyOtpOrRecovery(user, dto.otp, dto.recoveryCode);
    if (!ok) {
      await this.auditService.log({
        userId: user.id,
        action: AUDIT_ACTIONS.MFA_CHALLENGE_FAILED,
        resourceType: 'user',
        resourceId: user.id,
        ipAddress: ctx.ip,
        correlationId: ctx.correlationId,
        requestId: ctx.requestId,
      });
      throw new DomainException(
        ErrorCode.MFA_INVALID,
        'Invalid OTP or recovery code',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.auditService.log({
      userId: user.id,
      action: AUDIT_ACTIONS.MFA_CHALLENGE_PASSED,
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: ctx.ip,
      correlationId: ctx.correlationId,
      requestId: ctx.requestId,
    });

    return {
      userId: user.id,
      email: user.email,
      roles: user.roles.map((r) => r.role.name),
    };
  }

  private async verifyOtpOrRecovery(
    user: MfaUser,
    otp?: string,
    recoveryCode?: string,
  ): Promise<boolean> {
    if (otp && user.mfaSecret) {
      const secret = decryptSecret(user.mfaSecret, this.encryptionKey());
      const result = await verify({ secret, token: otp });
      if (result.valid) return true;
    }

    if (recoveryCode) {
      const hashes = Array.isArray(user.mfaRecoveryCodes)
        ? (user.mfaRecoveryCodes as string[])
        : [];
      const candidate = hashRecoveryCode(recoveryCode);
      const idx = hashes.indexOf(candidate);
      if (idx >= 0) {
        const remaining = [...hashes];
        remaining.splice(idx, 1);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { mfaRecoveryCodes: remaining },
        });
        return true;
      }
    }

    return false;
  }
}
