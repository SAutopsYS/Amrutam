import { CancelAppointmentService } from '../../src/modules/bookings/application/services/cancel-appointment.service';
import { AppointmentStatus } from '@prisma/client';
import { ErrorCode } from '../../src/common/constants';

describe('CancelAppointmentService', () => {
  const mockLogger = { log: jest.fn() };
  const mockPrisma = { $transaction: jest.fn((fn) => fn({})) };
  const slotRepository = { releaseSlot: jest.fn() };
  const appointmentRepository = {
    findById: jest.fn(),
    updateStatus: jest.fn(),
    addHistory: jest.fn(),
  };
  const auditService = { log: jest.fn() };
  const outboxService = { store: jest.fn() };
  const configService = { get: jest.fn().mockReturnValue(24) };

  let service: CancelAppointmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CancelAppointmentService(
      mockPrisma as never,
      slotRepository as never,
      appointmentRepository as never,
      auditService as never,
      outboxService as never,
      configService as never,
      mockLogger as never,
    );
  });

  it('rejects cancel for non-existent appointment', async () => {
    appointmentRepository.findById.mockResolvedValue(null);

    await expect(
      service.execute(
        { id: 'u1', email: 'a@b.com', status: 'ACTIVE' as never, roles: ['Patient'] },
        'missing-id',
        {},
        { requestId: 'r1', correlationId: 'c1' },
      ),
    ).rejects.toMatchObject({ code: ErrorCode.APPOINTMENT_NOT_FOUND });
  });

  it('rejects cancel for already cancelled appointment', async () => {
    appointmentRepository.findById.mockResolvedValue({
      id: 'appt-1',
      patientId: 'u1',
      doctorId: 'd1',
      slotId: 's1',
      status: AppointmentStatus.CANCELLED,
      scheduledStart: new Date(Date.now() + 86400000),
    });

    await expect(
      service.execute(
        { id: 'u1', email: 'a@b.com', status: 'ACTIVE' as never, roles: ['Patient'] },
        'appt-1',
        {},
        { requestId: 'r1', correlationId: 'c1' },
      ),
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_APPOINTMENT_STATUS });
  });
});
