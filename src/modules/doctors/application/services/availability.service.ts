import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode } from '@common/constants';
import { SlotStatus, VerificationStatus } from '@prisma/client';
import { ListSlotsQueryDto, CreateSlotDto } from '../dto/doctor.dto';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getDoctorProfile(doctorId: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId, verificationStatus: VerificationStatus.VERIFIED },
      select: {
        id: true,
        yearsOfExperience: true,
        consultationFee: true,
        bio: true,
        clinicName: true,
        supportsOnline: true,
        languagesSpoken: true,
        qualifications: true,
        user: { select: { profile: { select: { firstName: true, lastName: true } } } },
        specializations: { select: { specialization: { select: { name: true, slug: true } } } },
      },
    });

    if (!doctor) {
      throw new DomainException(
        ErrorCode.DOCTOR_NOT_FOUND,
        'Doctor not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      id: doctor.id,
      name: doctor.user.profile
        ? `${doctor.user.profile.firstName} ${doctor.user.profile.lastName}`
        : null,
      yearsOfExperience: doctor.yearsOfExperience,
      consultationFee: Number(doctor.consultationFee),
      bio: doctor.bio,
      clinicName: doctor.clinicName,
      supportsOnline: doctor.supportsOnline,
      languagesSpoken: doctor.languagesSpoken,
      qualifications: doctor.qualifications,
      specializations: doctor.specializations.map((s) => s.specialization),
    };
  }

  async listAvailableSlots(doctorId: string, query: ListSlotsQueryDto) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId, verificationStatus: VerificationStatus.VERIFIED },
    });
    if (!doctor) {
      throw new DomainException(
        ErrorCode.DOCTOR_NOT_FOUND,
        'Doctor not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const from = query.from ? new Date(query.from) : new Date();
    const to = query.to ? new Date(query.to) : new Date(Date.now() + 7 * 86400000);
    const limit = Math.min(query.limit ?? 20, 100);

    const slots = await this.prisma.availabilitySlot.findMany({
      where: {
        doctorId,
        status: SlotStatus.AVAILABLE,
        startTime: { gte: from, lte: to },
      },
      take: limit,
      orderBy: { startTime: 'asc' },
      select: { id: true, startTime: true, endTime: true, status: true, version: true },
    });

    return slots;
  }

  async createSlot(doctorId: string, dto: CreateSlotDto) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    if (endTime <= startTime) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'endTime must be after startTime',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.availabilitySlot.create({
      data: {
        doctorId,
        startTime,
        endTime,
        status: SlotStatus.AVAILABLE,
      },
      select: { id: true, startTime: true, endTime: true, status: true, version: true },
    });
  }
}
