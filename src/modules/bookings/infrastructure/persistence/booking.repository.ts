import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { TransactionClient } from '@database/transaction.client';

@Injectable()
export class BookingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: {
      appointmentId: string;
      patientId: string;
      idempotencyKey: string;
    },
    tx: TransactionClient,
  ) {
    return tx.booking.create({ data });
  }

  findByIdempotencyKey(idempotencyKey: string) {
    return this.prisma.booking.findUnique({
      where: { idempotencyKey },
      include: {
        appointment: {
          include: {
            slot: true,
            doctor: { include: { user: { include: { profile: true } } } },
          },
        },
      },
    });
  }
}
