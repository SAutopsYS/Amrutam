import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { TransactionClient } from '@database/transaction.client';
import { PaymentStatus, Prisma } from '@prisma/client';

@Injectable()
export class PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.payment.findUnique({
      where: { id },
      include: { attempts: true, refunds: true, appointment: true },
    });
  }

  findByProviderRef(providerRef: string) {
    return this.prisma.payment.findFirst({ where: { providerRef } });
  }

  async create(
    data: {
      appointmentId: string;
      patientId: string;
      amount: number;
      currency: string;
      idempotencyKey?: string;
    },
    tx: TransactionClient,
  ) {
    return tx.payment.create({
      data: {
        appointmentId: data.appointmentId,
        patientId: data.patientId,
        amount: data.amount,
        currency: data.currency,
        idempotencyKey: data.idempotencyKey,
        status: PaymentStatus.CREATED,
      },
    });
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    tx: TransactionClient,
    extra?: Partial<Prisma.PaymentUpdateInput>,
  ) {
    const current = await tx.payment.findUniqueOrThrow({ where: { id } });
    return tx.payment.update({
      where: { id, version: current.version },
      data: { status, version: { increment: 1 }, ...extra },
    });
  }

  async addAttempt(
    data: {
      paymentId: string;
      attemptNumber: number;
      status: PaymentStatus;
      providerRef?: string;
      errorMessage?: string;
    },
    tx: TransactionClient,
  ) {
    return tx.paymentAttempt.create({ data });
  }

  async findHistory(patientId: string, limit = 20) {
    return this.prisma.payment.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { appointment: { select: { scheduledStart: true } } },
    });
  }
}
