import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { TransactionClient } from '@database/transaction.client';
import { Prisma } from '@prisma/client';

export interface ClinicalNoteInput {
  consultationId: string;
  chiefComplaint?: string;
  symptoms?: string;
  diagnosis?: string;
  observations?: string;
  doctorNotes?: string;
  advice?: string;
  followUpInstructions?: string;
  attachmentsMeta?: Record<string, unknown>;
  createdBy: string;
}

@Injectable()
export class ClinicalNoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCurrent(consultationId: string) {
    return this.prisma.clinicalNote.findFirst({
      where: { consultationId, isCurrent: true },
    });
  }

  async create(input: ClinicalNoteInput, tx: TransactionClient) {
    await tx.clinicalNote.updateMany({
      where: { consultationId: input.consultationId, isCurrent: true },
      data: { isCurrent: false },
    });

    const latest = await tx.clinicalNote.findFirst({
      where: { consultationId: input.consultationId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    return tx.clinicalNote.create({
      data: {
        consultationId: input.consultationId,
        version: nextVersion,
        chiefComplaint: input.chiefComplaint,
        symptoms: input.symptoms,
        diagnosis: input.diagnosis,
        observations: input.observations,
        doctorNotes: input.doctorNotes,
        advice: input.advice,
        followUpInstructions: input.followUpInstructions,
        attachmentsMeta: input.attachmentsMeta as Prisma.InputJsonValue | undefined,
        isCurrent: true,
        createdBy: input.createdBy,
      },
    });
  }

  async getHistory(consultationId: string) {
    return this.prisma.clinicalNote.findMany({
      where: { consultationId },
      orderBy: { version: 'desc' },
    });
  }
}
