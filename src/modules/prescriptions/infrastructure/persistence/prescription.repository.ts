import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { TransactionClient } from '@database/transaction.client';
import { PrescriptionStatus, FoodRelation } from '@prisma/client';

export interface PrescriptionItemInput {
  medicineName: string;
  genericName?: string;
  strength: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string;
  foodRelation?: FoodRelation;
  notes?: string;
}

@Injectable()
export class PrescriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.prescription.findUnique({
      where: { id },
      include: {
        consultation: true,
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
          include: { items: true },
        },
      },
    });
  }

  findByConsultationId(consultationId: string) {
    return this.prisma.prescription.findMany({
      where: { consultationId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    data: {
      consultationId: string;
      createdBy: string;
      notes?: string;
      items: PrescriptionItemInput[];
    },
    tx: TransactionClient,
  ) {
    const prescription = await tx.prescription.create({
      data: {
        consultationId: data.consultationId,
        createdBy: data.createdBy,
        currentVersion: 1,
        status: PrescriptionStatus.ACTIVE,
        versions: {
          create: {
            version: 1,
            notes: data.notes,
            createdBy: data.createdBy,
            items: { create: data.items },
          },
        },
      },
      include: {
        versions: { include: { items: true }, orderBy: { version: 'desc' }, take: 1 },
      },
    });

    return prescription;
  }

  async createNewVersion(
    prescriptionId: string,
    data: { createdBy: string; notes?: string; items: PrescriptionItemInput[] },
    tx: TransactionClient,
  ) {
    const prescription = await tx.prescription.findUniqueOrThrow({ where: { id: prescriptionId } });
    const nextVersion = prescription.currentVersion + 1;

    await tx.prescription.update({
      where: { id: prescriptionId },
      data: {
        currentVersion: nextVersion,
        status: PrescriptionStatus.UPDATED,
      },
    });

    const version = await tx.prescriptionVersion.create({
      data: {
        prescriptionId,
        version: nextVersion,
        notes: data.notes,
        createdBy: data.createdBy,
        items: { create: data.items },
      },
      include: { items: true },
    });

    return { prescription, version };
  }

  async cancel(id: string, reason: string | undefined, tx: TransactionClient) {
    return tx.prescription.update({
      where: { id },
      data: {
        status: PrescriptionStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });
  }

  async getVersionHistory(prescriptionId: string) {
    return this.prisma.prescriptionVersion.findMany({
      where: { prescriptionId },
      include: { items: true },
      orderBy: { version: 'desc' },
    });
  }

  async getConsultationHistory(consultationId: string) {
    return this.prisma.prescription.findMany({
      where: { consultationId },
      include: {
        versions: {
          include: { items: true },
          orderBy: { version: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
