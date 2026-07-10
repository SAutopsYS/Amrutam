import { SlotRepository } from '../../src/modules/bookings/infrastructure/persistence/slot.repository';
import { SlotStatus } from '@prisma/client';
import { ErrorCode } from '../../src/common/constants';

describe('SlotRepository', () => {
  let repository: SlotRepository;
  let mockTx: {
    availabilitySlot: {
      updateMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(() => {
    mockTx = {
      availabilitySlot: {
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    repository = new SlotRepository({} as never);
  });

  describe('reserveSlot', () => {
    it('throws SLOT_ALREADY_BOOKED when optimistic lock fails', async () => {
      mockTx.availabilitySlot.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        repository.reserveSlot({ slotId: 'slot-1', expectedVersion: 3 }, mockTx as never),
      ).rejects.toMatchObject({
        code: ErrorCode.SLOT_ALREADY_BOOKED,
        message: 'Slot is no longer available',
      });
    });

    it('increments version and returns slot on successful reservation', async () => {
      const bookedSlot = { id: 'slot-1', status: SlotStatus.BOOKED, version: 4 };
      mockTx.availabilitySlot.updateMany.mockResolvedValue({ count: 1 });
      mockTx.availabilitySlot.findUniqueOrThrow.mockResolvedValue(bookedSlot);

      const result = await repository.reserveSlot(
        { slotId: 'slot-1', expectedVersion: 3 },
        mockTx as never,
      );

      expect(result).toEqual(bookedSlot);
      expect(mockTx.availabilitySlot.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'slot-1',
          status: SlotStatus.AVAILABLE,
          version: 3,
        },
        data: {
          status: SlotStatus.BOOKED,
          version: { increment: 1 },
        },
      });
    });
  });

  describe('releaseSlot', () => {
    it('sets slot AVAILABLE and increments version', async () => {
      mockTx.availabilitySlot.findUniqueOrThrow.mockResolvedValue({
        id: 'slot-1',
        version: 5,
      });

      await repository.releaseSlot('slot-1', mockTx as never);

      expect(mockTx.availabilitySlot.update).toHaveBeenCalledWith({
        where: { id: 'slot-1', version: 5 },
        data: {
          status: SlotStatus.AVAILABLE,
          version: { increment: 1 },
        },
      });
    });
  });
});
