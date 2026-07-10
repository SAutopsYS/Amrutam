import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { TransactionClient } from '@database/transaction.client';
import { SlotStatus } from '@prisma/client';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode } from '@common/constants';
import { HttpStatus } from '@nestjs/common';

export interface ReserveSlotInput {
  slotId: string;
  expectedVersion: number;
}

@Injectable()
export class SlotRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(slotId: string, tx?: TransactionClient) {
    const client = tx ?? this.prisma;
    return client.availabilitySlot.findUnique({ where: { id: slotId } });
  }

  findByIdForUpdate(slotId: string, tx: TransactionClient) {
    return tx.$queryRaw<
      Array<{
        id: string;
        doctor_id: string;
        start_time: Date;
        end_time: Date;
        status: SlotStatus;
        version: number;
      }>
    >`
      SELECT id, doctor_id, start_time, end_time, status, version
      FROM availability_slots
      WHERE id = ${slotId}::uuid
      FOR UPDATE
    `;
  }

  /**
   * Optimistic lock: only transition AVAILABLE → BOOKED if version matches.
   * Returns updated slot or throws on conflict — prevents double booking.
   */
  async reserveSlot(input: ReserveSlotInput, tx: TransactionClient) {
    const result = await tx.availabilitySlot.updateMany({
      where: {
        id: input.slotId,
        status: SlotStatus.AVAILABLE,
        version: input.expectedVersion,
      },
      data: {
        status: SlotStatus.BOOKED,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new DomainException(
        ErrorCode.SLOT_ALREADY_BOOKED,
        'Slot is no longer available',
        HttpStatus.CONFLICT,
      );
    }

    return tx.availabilitySlot.findUniqueOrThrow({ where: { id: input.slotId } });
  }

  async releaseSlot(slotId: string, tx: TransactionClient) {
    const slot = await tx.availabilitySlot.findUniqueOrThrow({
      where: { id: slotId },
    });

    await tx.availabilitySlot.update({
      where: { id: slotId, version: slot.version },
      data: {
        status: SlotStatus.AVAILABLE,
        version: { increment: 1 },
      },
    });
  }
}
