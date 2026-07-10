import { Injectable, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '@database/prisma.service';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode, RoleName, AUDIT_ACTIONS } from '@common/constants';
import { AuditService } from '@modules/audit/application/audit.service';
import { RequestContext } from '@common/interfaces/api-response.interface';
import { RegisterDto, LoginDto } from '../dto/auth.dto';
import { UserStatus } from '@prisma/client';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async register(dto: RegisterDto, ctx: RequestContext) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'Email already registered',
        HttpStatus.CONFLICT,
      );
    }

    const rounds = this.configService.get<number>('security.bcryptRounds') ?? 12;
    const passwordHash = await bcrypt.hash(dto.password, rounds);
    const patientRole = await this.prisma.role.findUniqueOrThrow({
      where: { name: RoleName.PATIENT },
    });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        status: UserStatus.ACTIVE,
        emailVerified: false,
        profile: {
          create: {
            firstName: dto.firstName,
            lastName: dto.lastName,
          },
        },
        roles: { create: { roleId: patientRole.id } },
      },
      include: { roles: { include: { role: true } }, profile: true },
    });

    await this.auditService.log({
      userId: user.id,
      action: AUDIT_ACTIONS.REGISTER,
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
      requestId: ctx.requestId,
    });

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      user.roles.map((r) => r.role.name),
      ctx,
    );
    return {
      user: this.mapUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto, ctx: RequestContext) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        roles: { include: { role: true } },
        profile: true,
        doctor: { select: { id: true } },
      },
    });

    if (!user) {
      await this.auditService.log({
        action: AUDIT_ACTIONS.FAILED_LOGIN,
        metadata: { email: dto.email, reason: 'user_not_found' },
        ipAddress: ctx.ip,
        correlationId: ctx.correlationId,
        requestId: ctx.requestId,
      });
      throw new DomainException(
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new DomainException(
        ErrorCode.ACCOUNT_INACTIVE,
        'Account is not active',
        HttpStatus.FORBIDDEN,
      );
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.auditService.log({
        userId: user.id,
        action: AUDIT_ACTIONS.FAILED_LOGIN,
        metadata: { reason: 'invalid_password' },
        ipAddress: ctx.ip,
        correlationId: ctx.correlationId,
        requestId: ctx.requestId,
      });
      throw new DomainException(
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.log({
      userId: user.id,
      action: AUDIT_ACTIONS.LOGIN,
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
      requestId: ctx.requestId,
    });

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      user.roles.map((r) => r.role.name),
      ctx,
    );
    return {
      user: this.mapUser(user),
      ...tokens,
    };
  }

  async refresh(refreshToken: string, ctx: RequestContext) {
    let payload: { sub: string; email: string; roles: string[] };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Invalid refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, userId: payload.sub, isRevoked: false },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Refresh token expired or revoked',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    return this.issueTokens(payload.sub, payload.email, payload.roles, ctx);
  }

  async logout(userId: string, refreshToken: string, ctx: RequestContext) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    await this.auditService.log({
      userId,
      action: AUDIT_ACTIONS.LOGOUT,
      resourceType: 'user',
      resourceId: userId,
      ipAddress: ctx.ip,
      correlationId: ctx.correlationId,
      requestId: ctx.requestId,
    });

    return { loggedOut: true };
  }

  private async issueTokens(
    userId: string,
    email: string,
    roles: string[],
    ctx: RequestContext,
  ): Promise<TokenPair> {
    const accessExpiresIn = this.configService.get<string>('jwt.accessExpiresIn') ?? '15m';
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';

    const accessToken = this.jwtService.sign({ sub: userId, email, roles });
    const refreshToken = this.jwtService.sign(
      { sub: userId, email, roles },
      { secret: this.configService.get<string>('jwt.refreshSecret'), expiresIn: refreshExpiresIn },
    );

    const session = await this.prisma.userSession.create({
      data: {
        userId,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      },
    });

    const refreshMs = this.parseExpiry(refreshExpiresIn);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        sessionId: session.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshMs),
      },
    });

    return { accessToken, refreshToken, expiresIn: accessExpiresIn };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseExpiry(exp: string): number {
    const match = exp.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 86400000;
    const n = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return n * (multipliers[unit] ?? 86400000);
  }

  private mapUser(user: {
    id: string;
    email: string;
    status: UserStatus;
    profile: { firstName: string; lastName: string } | null;
    roles: { role: { name: string } }[];
    doctor?: { id: string } | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      roles: user.roles.map((r) => r.role.name),
      profile: user.profile,
      doctorId: user.doctor?.id,
    };
  }
}
