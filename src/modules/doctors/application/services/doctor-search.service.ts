import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { CacheService } from '@common/cache/cache.service';
import { VerificationStatus, Prisma } from '@prisma/client';
import { SearchDoctorsQueryDto } from '../dto/doctor.dto';

@Injectable()
export class DoctorSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async search(query: SearchDoctorsQueryDto) {
    const limit = Math.min(query.limit ?? 20, 50);
    const cacheKey = `doctors:search:${query.keyword ?? ''}:${query.specialization ?? ''}:${limit}`;

    return this.cache.getOrSet(cacheKey, () => this.executeSearch(query, limit), 60);
  }

  private async executeSearch(query: SearchDoctorsQueryDto, limit: number) {
    const where: Prisma.DoctorWhereInput = {
      verificationStatus: VerificationStatus.VERIFIED,
      supportsOnline: true,
    };

    if (query.specialization) {
      where.specializations = {
        some: { specialization: { slug: query.specialization } },
      };
    }

    if (query.keyword) {
      where.OR = [
        { bio: { contains: query.keyword, mode: 'insensitive' } },
        { user: { profile: { firstName: { contains: query.keyword, mode: 'insensitive' } } } },
        { user: { profile: { lastName: { contains: query.keyword, mode: 'insensitive' } } } },
        {
          specializations: {
            some: { specialization: { name: { contains: query.keyword, mode: 'insensitive' } } },
          },
        },
      ];
    }

    const doctors = await this.prisma.doctor.findMany({
      where,
      take: limit,
      orderBy: { yearsOfExperience: 'desc' },
      select: {
        id: true,
        yearsOfExperience: true,
        consultationFee: true,
        bio: true,
        supportsOnline: true,
        languagesSpoken: true,
        user: { select: { profile: { select: { firstName: true, lastName: true } } } },
        specializations: { select: { specialization: { select: { name: true, slug: true } } } },
      },
    });

    return doctors.map((d) => ({
      id: d.id,
      name: d.user.profile ? `${d.user.profile.firstName} ${d.user.profile.lastName}` : null,
      yearsOfExperience: d.yearsOfExperience,
      consultationFee: Number(d.consultationFee),
      bio: d.bio,
      languagesSpoken: d.languagesSpoken,
      specializations: d.specializations.map((s) => s.specialization),
    }));
  }
}
