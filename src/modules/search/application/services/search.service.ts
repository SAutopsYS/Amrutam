import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode } from '@common/constants';

export interface GlobalSearchParams {
  keyword: string;
  types?: string[];
  cursor?: string;
  limit?: number;
  isAdmin?: boolean;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async globalSearch(params: GlobalSearchParams) {
    const limit = Math.min(params.limit ?? 10, 50);
    const keyword = params.keyword.trim();
    if (!keyword) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Keyword is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const types = params.types ?? ['doctors', 'appointments', 'consultations', 'prescriptions'];
    const results: Record<string, unknown[]> = {};

    if (types.includes('doctors')) {
      results.doctors = await this.prisma.doctor.findMany({
        where: {
          OR: [
            { bio: { contains: keyword, mode: 'insensitive' } },
            { user: { profile: { firstName: { contains: keyword, mode: 'insensitive' } } } },
            { user: { profile: { lastName: { contains: keyword, mode: 'insensitive' } } } },
          ],
        },
        take: limit,
        include: {
          user: { include: { profile: true } },
          specializations: { include: { specialization: true } },
        },
      });
    }

    if (types.includes('appointments')) {
      results.appointments = await this.prisma.appointment.findMany({
        where: { reason: { contains: keyword, mode: 'insensitive' } },
        take: limit,
        orderBy: { scheduledStart: 'desc' },
      });
    }

    if (types.includes('consultations')) {
      results.consultations = await this.prisma.consultation.findMany({
        where: {
          clinicalNotes: {
            some: {
              OR: [
                { diagnosis: { contains: keyword, mode: 'insensitive' } },
                { chiefComplaint: { contains: keyword, mode: 'insensitive' } },
              ],
            },
          },
        },
        take: limit,
        include: { patient: { include: { profile: true } } },
      });
    }

    if (types.includes('prescriptions')) {
      results.prescriptions = await this.prisma.prescription.findMany({
        where: {
          versions: {
            some: {
              items: { some: { medicineName: { contains: keyword, mode: 'insensitive' } } },
            },
          },
        },
        take: limit,
      });
    }

    if (params.isAdmin && types.includes('patients')) {
      results.patients = await this.prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: keyword, mode: 'insensitive' } },
            { profile: { firstName: { contains: keyword, mode: 'insensitive' } } },
            { profile: { lastName: { contains: keyword, mode: 'insensitive' } } },
          ],
        },
        take: limit,
        include: { profile: true },
      });
    }

    return { keyword, results };
  }
}
