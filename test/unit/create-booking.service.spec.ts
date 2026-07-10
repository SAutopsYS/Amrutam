import { CreateBookingService } from '../../src/modules/bookings/application/services/create-booking.service';
import { ErrorCode } from '../../src/common/constants';
import { UserStatus, VerificationStatus, SlotStatus } from '@prisma/client';

describe('CreateBookingService', () => {
  const mockLogger = { log: jest.fn(), error: jest.fn() };
  const mockPrisma = {
    $transaction: jest.fn((fn) => fn(mockTx)),
  };
  const mockTx = {
    doctor: { findUnique: jest.fn() },
    leave: { findFirst: jest.fn() },
  };

  const slotRepository = {
    findById: jest.fn(),
    reserveSlot: jest.fn(),
  };
  const appointmentRepository = {
    create: jest.fn(),
    addHistory: jest.fn(),
  };
  const bookingRepository = { create: jest.fn() };
  const idempotencyRepository = {
    findByKey: jest.fn(),
    createProcessing: jest.fn(),
    complete: jest.fn(),
  };
  const auditService = { log: jest.fn() };
  const outboxService = {
    store: jest.fn(),
    buildAppointmentBookedPayload: jest.fn().mockReturnValue({}),
  };

  let service: CreateBookingService;

  const patientUser = {
    id: 'patient-id',
    email: 'patient@test.com',
    status: UserStatus.ACTIVE,
    roles: ['Patient'],
  };

  const ctx = { requestId: 'req-1', correlationId: 'corr-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CreateBookingService(
      mockPrisma as never,
      slotRepository as never,
      appointmentRepository as never,
      bookingRepository as never,
      idempotencyRepository as never,
      auditService as never,
      outboxService as never,
      mockLogger as never,
    );
  });

  it('requires idempotency key', async () => {
    await expect(
      service.execute(patientUser, { doctorId: 'd1', slotId: 's1' }, '', ctx as never),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });

  it('returns cached response on idempotent replay', async () => {
    const cached = { id: 'appt-1', status: 'CONFIRMED' };
    idempotencyRepository.findByKey.mockResolvedValue({
      status: 'COMPLETED',
      responseBody: cached,
      appointmentId: 'appt-1',
    });

    const result = await service.execute(
      patientUser,
      { doctorId: 'd1', slotId: 's1' },
      'key-1',
      ctx as never,
    );

    expect(result).toEqual(cached);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects doctor self-booking', async () => {
    idempotencyRepository.findByKey.mockResolvedValue(null);
    idempotencyRepository.createProcessing.mockResolvedValue({ id: 'idem-1' });

    const futureDate = new Date(Date.now() + 86400000);
    slotRepository.findById.mockResolvedValue({
      id: 'slot-1',
      doctorId: 'doc-1',
      startTime: futureDate,
      endTime: futureDate,
      status: SlotStatus.AVAILABLE,
      version: 1,
    });

    mockTx.doctor.findUnique.mockResolvedValue({
      id: 'doc-1',
      userId: patientUser.id,
      verificationStatus: VerificationStatus.VERIFIED,
      consultationFee: 500,
      user: { profile: { firstName: 'Self', lastName: 'Doctor' } },
    });
    mockTx.leave.findFirst.mockResolvedValue(null);

    await expect(
      service.execute(patientUser, { doctorId: 'doc-1', slotId: 'slot-1' }, 'key-2', ctx as never),
    ).rejects.toMatchObject({
      code: ErrorCode.DOCTOR_SELF_BOOKING,
      getStatus: expect.any(Function),
    });
  });

  it('rejects booking past slots', async () => {
    idempotencyRepository.findByKey.mockResolvedValue(null);
    idempotencyRepository.createProcessing.mockResolvedValue({ id: 'idem-1' });

    const pastDate = new Date(Date.now() - 3600000);
    slotRepository.findById.mockResolvedValue({
      id: 'slot-1',
      doctorId: 'doc-1',
      startTime: pastDate,
      endTime: pastDate,
      status: SlotStatus.AVAILABLE,
      version: 1,
    });

    mockTx.doctor.findUnique.mockResolvedValue({
      id: 'doc-1',
      userId: 'other-user',
      verificationStatus: VerificationStatus.VERIFIED,
      consultationFee: 500,
      user: { profile: { firstName: 'Doc', lastName: 'Tor' } },
    });
    mockTx.leave.findFirst.mockResolvedValue(null);

    await expect(
      service.execute(patientUser, { doctorId: 'doc-1', slotId: 'slot-1' }, 'key-3', ctx as never),
    ).rejects.toMatchObject({ code: ErrorCode.PAST_APPOINTMENT });
  });
});
