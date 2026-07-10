import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { TransactionClient } from '@database/transaction.client';
import { createRequestHash } from '@common/utils/helpers';

const IDEMPOTENCY_TTL_HOURS = 24;

@Injectable()
export class IdempotencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByKey(idempotencyKey: string, patientId: string) {
    return this.prisma.bookingIdempotency.findFirst({
      where: {
        idempotencyKey,
        patientId,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async createProcessing(
    idempotencyKey: string,
    patientId: string,
    requestPayload: Record<string, unknown>,
    tx: TransactionClient,
  ) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_TTL_HOURS);

    return tx.bookingIdempotency.create({
      data: {
        idempotencyKey,
        patientId,
        requestHash: createRequestHash(requestPayload),
        status: 'PROCESSING',
        expiresAt,
      },
    });
  }

  async complete(
    id: string,
    appointmentId: string,
    responseBody: Record<string, unknown>,
    tx: TransactionClient,
  ) {
    return tx.bookingIdempotency.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        appointmentId,
        responseBody: responseBody as object,
      },
    });
  }

  async fail(id: string, tx: TransactionClient) {
    return tx.bookingIdempotency.update({
      where: { id },
      data: { status: 'FAILED' },
    });
  }
}
