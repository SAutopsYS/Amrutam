import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode } from '@common/constants';
import { CreateLeaveDto } from '../dto/doctor.dto';

@Injectable()
export class LeaveService {
  constructor(private readonly prisma: PrismaService) {}

  async createLeave(doctorId: string, dto: CreateLeaveDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate < startDate) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'endDate must be on or after startDate',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.leave.create({
      data: {
        doctorId,
        startDate,
        endDate,
        reason: dto.reason,
      },
    });
  }

  async listLeaves(doctorId: string) {
    return this.prisma.leave.findMany({
      where: { doctorId },
      orderBy: { startDate: 'desc' },
      take: 50,
    });
  }
}
