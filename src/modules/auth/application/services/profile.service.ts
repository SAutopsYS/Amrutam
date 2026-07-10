import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode, AUDIT_ACTIONS } from '@common/constants';
import { AuditService } from '@modules/audit/application/audit.service';
import { RequestContext } from '@common/interfaces/api-response.interface';
import { UpdateProfileDto } from '../dto/auth.dto';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        status: true,
        profile: true,
        roles: { select: { role: { select: { name: true } } } },
        doctor: { select: { id: true, verificationStatus: true } },
      },
    });

    if (!user) {
      throw new DomainException(ErrorCode.USER_NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      status: user.status,
      roles: user.roles.map((r) => r.role.name),
      profile: user.profile,
      doctorId: user.doctor?.id,
      doctorVerificationStatus: user.doctor?.verificationStatus,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto, ctx: RequestContext) {
    const profile = await this.prisma.profile.update({
      where: { userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        timezone: dto.timezone,
        language: dto.language,
      },
    });

    await this.auditService.log({
      userId,
      action: AUDIT_ACTIONS.PROFILE_UPDATE,
      resourceType: 'profile',
      resourceId: profile.id,
      newValue: dto as Record<string, unknown>,
      ipAddress: ctx.ip,
      correlationId: ctx.correlationId,
      requestId: ctx.requestId,
    });

    return profile;
  }
}
