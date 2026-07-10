import { Injectable, Inject, LoggerService, HttpStatus } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { PrismaService } from '@database/prisma.service';
import { ConsultationStatus, TimelineEventType } from '@prisma/client';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode, AUDIT_ACTIONS, OUTBOX_EVENTS } from '@common/constants';
import { RequestContext } from '@common/interfaces/api-response.interface';
import { AuditService } from '@modules/audit/application/audit.service';
import { OutboxService } from '@/events/outbox.service';
import { ConsultationRepository } from '@modules/consultations/infrastructure/persistence/consultation.repository';
import {
  ConsultationAccessService,
  AuthUser,
} from '@modules/consultations/application/services/consultation.services';
import { PrescriptionRepository } from '../../infrastructure/persistence/prescription.repository';
import {
  CreatePrescriptionDto,
  UpdatePrescriptionDto,
  CancelPrescriptionDto,
} from '../dto/prescription.dto';

@Injectable()
export class PrescriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prescriptionRepo: PrescriptionRepository,
    private readonly consultationRepo: ConsultationRepository,
    private readonly accessService: ConsultationAccessService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) {}

  private validateItems(items: CreatePrescriptionDto['items']) {
    for (const item of items) {
      if (!item.medicineName?.trim()) {
        throw new DomainException(
          ErrorCode.VALIDATION_ERROR,
          'Medicine name is required',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (item.durationDays <= 0) {
        throw new DomainException(
          ErrorCode.VALIDATION_ERROR,
          'Duration must be positive',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  async createForConsultation(
    user: AuthUser,
    consultationId: string,
    dto: CreatePrescriptionDto,
    ctx: RequestContext,
  ) {
    const start = Date.now();
    this.validateItems(dto.items);

    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new DomainException(
        ErrorCode.CONSULTATION_NOT_FOUND,
        'Consultation not found',
        HttpStatus.NOT_FOUND,
      );
    }
    this.accessService.assertDoctorWrite(user, consultation);

    if (consultation.status === ConsultationStatus.CANCELLED) {
      throw new DomainException(
        ErrorCode.INVALID_CONSULTATION_STATUS,
        'Cannot prescribe for cancelled consultation',
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const prescription = await this.prescriptionRepo.create(
        { consultationId, createdBy: user.id, notes: dto.notes, items: dto.items },
        tx,
      );

      await this.consultationRepo.addTimelineEvent(
        {
          consultationId,
          eventType: TimelineEventType.PRESCRIPTION_CREATED,
          performedBy: user.id,
          description: 'Prescription created',
          metadata: { prescriptionId: prescription.id },
        },
        tx,
      );

      await this.auditService.log(
        {
          userId: user.id,
          action: AUDIT_ACTIONS.PRESCRIPTION_CREATED,
          resourceType: 'Prescription',
          resourceId: prescription.id,
          newValue: { consultationId, version: 1 },
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
          correlationId: ctx.correlationId,
          requestId: ctx.requestId,
        },
        tx,
      );

      await this.outboxService.store(
        {
          aggregateType: 'Prescription',
          aggregateId: prescription.id,
          eventType: OUTBOX_EVENTS.PRESCRIPTION_CREATED,
          payload: {
            prescriptionId: prescription.id,
            consultationId,
            patientId: consultation.patientId,
            doctorId: consultation.doctorId,
            notification: { patientId: consultation.patientId },
            pdfJob: { prescriptionId: prescription.id },
          },
        },
        tx,
      );

      return prescription;
    });

    this.logger.log({
      message: 'Prescription created',
      requestId: ctx.requestId,
      userId: user.id,
      consultationId,
      prescriptionId: result.id,
      latency: Date.now() - start,
    });

    return this.mapPrescription(result);
  }

  async update(
    user: AuthUser,
    prescriptionId: string,
    dto: UpdatePrescriptionDto,
    ctx: RequestContext,
  ) {
    const start = Date.now();
    this.validateItems(dto.items);

    const existing = await this.prescriptionRepo.findById(prescriptionId);
    if (!existing) {
      throw new DomainException(
        ErrorCode.PRESCRIPTION_NOT_FOUND,
        'Prescription not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (existing.status === 'CANCELLED') {
      throw new DomainException(
        ErrorCode.PRESCRIPTION_CANCELLED,
        'Prescription is cancelled',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.accessService.assertDoctorWrite(user, existing.consultation);

    const result = await this.prisma.$transaction(async (tx) => {
      const { prescription, version } = await this.prescriptionRepo.createNewVersion(
        prescriptionId,
        { createdBy: user.id, notes: dto.notes, items: dto.items },
        tx,
      );

      await this.consultationRepo.addTimelineEvent(
        {
          consultationId: existing.consultationId,
          eventType: TimelineEventType.PRESCRIPTION_UPDATED,
          performedBy: user.id,
          metadata: { prescriptionId, version: version.version },
        },
        tx,
      );

      await this.auditService.log(
        {
          userId: user.id,
          action: AUDIT_ACTIONS.PRESCRIPTION_UPDATED,
          resourceType: 'Prescription',
          resourceId: prescriptionId,
          oldValue: { version: existing.currentVersion },
          newValue: { version: version.version },
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
          correlationId: ctx.correlationId,
          requestId: ctx.requestId,
        },
        tx,
      );

      await this.outboxService.store(
        {
          aggregateType: 'Prescription',
          aggregateId: prescriptionId,
          eventType: OUTBOX_EVENTS.PRESCRIPTION_UPDATED,
          payload: {
            prescriptionId,
            version: version.version,
            consultationId: existing.consultationId,
            pdfJob: { prescriptionId, version: version.version },
          },
        },
        tx,
      );

      return { prescription, version };
    });

    this.logger.log({
      message: 'Prescription updated',
      requestId: ctx.requestId,
      prescriptionId,
      version: result.version.version,
      latency: Date.now() - start,
    });

    return this.mapPrescription(result.prescription);
  }

  async cancel(
    user: AuthUser,
    prescriptionId: string,
    dto: CancelPrescriptionDto,
    ctx: RequestContext,
  ) {
    const existing = await this.prescriptionRepo.findById(prescriptionId);
    if (!existing) {
      throw new DomainException(
        ErrorCode.PRESCRIPTION_NOT_FOUND,
        'Prescription not found',
        HttpStatus.NOT_FOUND,
      );
    }
    this.accessService.assertDoctorWrite(user, existing.consultation);

    await this.prisma.$transaction(async (tx) => {
      await this.prescriptionRepo.cancel(prescriptionId, dto.reason, tx);

      await this.auditService.log(
        {
          userId: user.id,
          action: AUDIT_ACTIONS.PRESCRIPTION_CANCELLED,
          resourceType: 'Prescription',
          resourceId: prescriptionId,
          newValue: { reason: dto.reason },
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
          correlationId: ctx.correlationId,
          requestId: ctx.requestId,
        },
        tx,
      );

      await this.outboxService.store(
        {
          aggregateType: 'Prescription',
          aggregateId: prescriptionId,
          eventType: OUTBOX_EVENTS.PRESCRIPTION_CANCELLED,
          payload: { prescriptionId, reason: dto.reason },
        },
        tx,
      );
    });

    return { id: prescriptionId, status: 'CANCELLED' };
  }

  async getById(user: AuthUser, prescriptionId: string) {
    const prescription = await this.prescriptionRepo.findById(prescriptionId);
    if (!prescription) {
      throw new DomainException(
        ErrorCode.PRESCRIPTION_NOT_FOUND,
        'Prescription not found',
        HttpStatus.NOT_FOUND,
      );
    }
    this.accessService.assertAccess(user, prescription.consultation);
    return this.mapPrescription(prescription);
  }

  async getConsultationHistory(user: AuthUser, consultationId: string) {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new DomainException(
        ErrorCode.CONSULTATION_NOT_FOUND,
        'Consultation not found',
        HttpStatus.NOT_FOUND,
      );
    }
    this.accessService.assertAccess(user, consultation);

    const prescriptions = await this.prescriptionRepo.getConsultationHistory(consultationId);
    return prescriptions.map((p) => ({
      id: p.id,
      status: p.status,
      currentVersion: p.currentVersion,
      versions: p.versions.map((v) => ({
        version: v.version,
        notes: v.notes,
        createdAt: v.createdAt,
        items: v.items,
      })),
    }));
  }

  private mapPrescription(p: {
    id: string;
    status: string;
    currentVersion: number;
    consultationId: string;
    versions?: Array<{ version: number; notes?: string | null; items: unknown[] }>;
  }) {
    const current = p.versions?.[0];
    return {
      id: p.id,
      status: p.status,
      currentVersion: p.currentVersion,
      consultationId: p.consultationId,
      notes: current?.notes,
      items: current?.items ?? [],
    };
  }
}
