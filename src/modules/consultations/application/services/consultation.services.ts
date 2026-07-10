import { Injectable, Inject, LoggerService, HttpStatus } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { PrismaService } from '@database/prisma.service';
import { ConsultationStatus, TimelineEventType } from '@prisma/client';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode, AUDIT_ACTIONS, OUTBOX_EVENTS } from '@common/constants';
import { RequestContext } from '@common/interfaces/api-response.interface';
import { sanitizeForLog } from '@common/utils/masking.util';
import { AuditService } from '@modules/audit/application/audit.service';
import { OutboxService } from '@/events/outbox.service';
import {
  canConsultationTransition,
  ConsultationStatusEnum,
} from '../../domain/enums/consultation-status.enum';
import { ConsultationRepository } from '../../infrastructure/persistence/consultation.repository';
import { ClinicalNoteRepository } from '../../infrastructure/persistence/clinical-note.repository';
import { UpsertClinicalNoteDto } from '../dto/consultation.dto';

export interface AuthUser {
  id: string;
  roles: string[];
  doctorId?: string;
}

@Injectable()
export class ConsultationAccessService {
  assertAccess(user: AuthUser, consultation: { patientId: string; doctorId: string }): void {
    const isPatient = consultation.patientId === user.id;
    const isDoctor = user.doctorId === consultation.doctorId;
    const isAdmin = user.roles.includes('Admin') || user.roles.includes('Super Admin');

    if (!isPatient && !isDoctor && !isAdmin) {
      throw new DomainException(ErrorCode.FORBIDDEN, 'Access denied', HttpStatus.FORBIDDEN);
    }
  }

  assertDoctorWrite(user: AuthUser, consultation: { doctorId: string }): void {
    if (user.doctorId !== consultation.doctorId) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'Only assigned doctor can modify',
        HttpStatus.FORBIDDEN,
      );
    }
  }
}

@Injectable()
export class StartConsultationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consultationRepo: ConsultationRepository,
    private readonly accessService: ConsultationAccessService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) {}

  async execute(user: AuthUser, consultationId: string, ctx: RequestContext) {
    const start = Date.now();
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new DomainException(
        ErrorCode.CONSULTATION_NOT_FOUND,
        'Consultation not found',
        HttpStatus.NOT_FOUND,
      );
    }

    this.accessService.assertDoctorWrite(user, consultation);

    const fromStatus = consultation.status as ConsultationStatusEnum;
    const targetStatus =
      fromStatus === ConsultationStatusEnum.SCHEDULED
        ? ConsultationStatusEnum.IN_PROGRESS
        : ConsultationStatusEnum.IN_PROGRESS;

    if (!canConsultationTransition(fromStatus, targetStatus)) {
      throw new DomainException(
        ErrorCode.INVALID_CONSULTATION_STATUS,
        `Cannot start consultation in ${consultation.status} status`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await this.consultationRepo.updateStatus(
        consultationId,
        ConsultationStatus.IN_PROGRESS,
        tx,
        { startedAt: new Date() },
      );

      await this.consultationRepo.addTimelineEvent(
        {
          consultationId,
          eventType: TimelineEventType.STARTED,
          description: 'Consultation started',
          performedBy: user.id,
        },
        tx,
      );

      await this.auditService.log(
        {
          userId: user.id,
          action: AUDIT_ACTIONS.CONSULTATION_STARTED,
          resourceType: 'Consultation',
          resourceId: consultationId,
          oldValue: { status: consultation.status },
          newValue: { status: ConsultationStatus.IN_PROGRESS },
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
          correlationId: ctx.correlationId,
          requestId: ctx.requestId,
        },
        tx,
      );

      await this.outboxService.store(
        {
          aggregateType: 'Consultation',
          aggregateId: consultationId,
          eventType: OUTBOX_EVENTS.CONSULTATION_STARTED,
          payload: {
            consultationId,
            patientId: consultation.patientId,
            doctorId: consultation.doctorId,
            appointmentId: consultation.appointmentId,
          },
        },
        tx,
      );

      return updated;
    });

    this.logger.log({
      message: 'Consultation started',
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      userId: user.id,
      consultationId,
      latency: Date.now() - start,
    });

    return { id: result.id, status: result.status, startedAt: result.startedAt };
  }
}

@Injectable()
export class CompleteConsultationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consultationRepo: ConsultationRepository,
    private readonly accessService: ConsultationAccessService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) {}

  async execute(
    user: AuthUser,
    consultationId: string,
    followUp: { followUpDate?: string; followUpNotes?: string },
    ctx: RequestContext,
  ) {
    const start = Date.now();
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new DomainException(
        ErrorCode.CONSULTATION_NOT_FOUND,
        'Consultation not found',
        HttpStatus.NOT_FOUND,
      );
    }

    this.accessService.assertDoctorWrite(user, consultation);

    if (
      !canConsultationTransition(
        consultation.status as ConsultationStatusEnum,
        ConsultationStatusEnum.COMPLETED,
      )
    ) {
      throw new DomainException(
        ErrorCode.INVALID_CONSULTATION_STATUS,
        `Cannot complete consultation in ${consultation.status} status`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await this.consultationRepo.updateStatus(
        consultationId,
        ConsultationStatus.COMPLETED,
        tx,
        {
          completedAt: new Date(),
          followUpDate: followUp.followUpDate ? new Date(followUp.followUpDate) : undefined,
          followUpNotes: followUp.followUpNotes,
        },
      );

      await this.consultationRepo.addTimelineEvent(
        {
          consultationId,
          eventType: TimelineEventType.COMPLETED,
          description: 'Consultation completed',
          performedBy: user.id,
        },
        tx,
      );

      await this.auditService.log(
        {
          userId: user.id,
          action: AUDIT_ACTIONS.CONSULTATION_COMPLETED,
          resourceType: 'Consultation',
          resourceId: consultationId,
          oldValue: { status: consultation.status },
          newValue: { status: ConsultationStatus.COMPLETED },
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
          correlationId: ctx.correlationId,
          requestId: ctx.requestId,
        },
        tx,
      );

      await this.outboxService.store(
        {
          aggregateType: 'Consultation',
          aggregateId: consultationId,
          eventType: OUTBOX_EVENTS.CONSULTATION_COMPLETED,
          payload: {
            consultationId,
            patientId: consultation.patientId,
            doctorId: consultation.doctorId,
            notification: { patientId: consultation.patientId },
            analytics: { eventName: OUTBOX_EVENTS.CONSULTATION_COMPLETED },
          },
        },
        tx,
      );

      return updated;
    });

    this.logger.log({
      message: 'Consultation completed',
      requestId: ctx.requestId,
      userId: user.id,
      consultationId,
      latency: Date.now() - start,
      metadata: sanitizeForLog({ followUpNotes: followUp.followUpNotes }),
    });

    return { id: result.id, status: result.status, completedAt: result.completedAt };
  }
}

@Injectable()
export class GetConsultationService {
  constructor(
    private readonly consultationRepo: ConsultationRepository,
    private readonly accessService: ConsultationAccessService,
  ) {}

  async getById(user: AuthUser, id: string) {
    const consultation = await this.consultationRepo.findById(id);
    if (!consultation) {
      throw new DomainException(
        ErrorCode.CONSULTATION_NOT_FOUND,
        'Consultation not found',
        HttpStatus.NOT_FOUND,
      );
    }
    this.accessService.assertAccess(user, consultation);
    return this.mapConsultation(consultation);
  }

  async getHistory(
    user: AuthUser,
    query: {
      status?: string;
      fromDate?: string;
      toDate?: string;
      keyword?: string;
      doctorId?: string;
      cursor?: string;
      limit?: number;
    },
  ) {
    const filters = {
      patientId: user.roles.includes('Patient') ? user.id : undefined,
      doctorId: user.roles.includes('Doctor') ? user.doctorId : query.doctorId,
      status: query.status as ConsultationStatus | undefined,
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      toDate: query.toDate ? new Date(query.toDate) : undefined,
      keyword: query.keyword,
      cursor: query.cursor,
      limit: query.limit ? Number(query.limit) : 20,
    };

    if (user.roles.includes('Admin') || user.roles.includes('Super Admin')) {
      filters.patientId = undefined;
    }

    const result = await this.consultationRepo.findMany(filters);
    return {
      data: result.items.map((c) => this.mapConsultation(c)),
      meta: { hasMore: result.hasMore, nextCursor: result.nextCursor },
    };
  }

  async getMyConsultations(user: AuthUser, query: { cursor?: string; limit?: number }) {
    const filters = {
      patientId: user.roles.includes('Patient') ? user.id : undefined,
      doctorId: user.roles.includes('Doctor') ? user.doctorId : undefined,
      cursor: query.cursor,
      limit: query.limit ? Number(query.limit) : 20,
    };
    const result = await this.consultationRepo.findMany(filters);
    return {
      data: result.items.map((c) => this.mapConsultation(c)),
      meta: { hasMore: result.hasMore, nextCursor: result.nextCursor },
    };
  }

  private mapConsultation(c: {
    id: string;
    status: ConsultationStatus;
    startedAt?: Date | null;
    completedAt?: Date | null;
    followUpDate?: Date | null;
    followUpNotes?: string | null;
    appointment?: { scheduledStart: Date; scheduledEnd: Date };
    clinicalNotes?: Array<{ id: string; version: number; diagnosis?: string | null }>;
    timeline?: Array<{ eventType: string; description?: string | null; createdAt: Date }>;
    patient?: { id: string; profile?: { firstName: string; lastName: string } | null };
    doctor?: { id: string; user?: { profile?: { firstName: string; lastName: string } | null } };
  }) {
    return {
      id: c.id,
      status: c.status,
      startedAt: c.startedAt,
      completedAt: c.completedAt,
      followUpDate: c.followUpDate,
      followUpNotes: c.followUpNotes,
      appointment: c.appointment,
      currentNote: c.clinicalNotes?.[0] ?? null,
      timeline: c.timeline,
      patient: c.patient
        ? {
            id: c.patient.id,
            name: c.patient.profile
              ? `${c.patient.profile.firstName} ${c.patient.profile.lastName}`
              : null,
          }
        : undefined,
      doctor: c.doctor
        ? {
            id: c.doctor.id,
            name: c.doctor.user?.profile
              ? `${c.doctor.user.profile.firstName} ${c.doctor.user.profile.lastName}`
              : null,
          }
        : undefined,
    };
  }
}

@Injectable()
export class ClinicalNoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consultationRepo: ConsultationRepository,
    private readonly noteRepo: ClinicalNoteRepository,
    private readonly accessService: ConsultationAccessService,
    private readonly auditService: AuditService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) {}

  async upsert(
    user: AuthUser,
    consultationId: string,
    dto: UpsertClinicalNoteDto,
    ctx: RequestContext,
  ) {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new DomainException(
        ErrorCode.CONSULTATION_NOT_FOUND,
        'Consultation not found',
        HttpStatus.NOT_FOUND,
      );
    }
    this.accessService.assertDoctorWrite(user, consultation);

    const oldNote = await this.noteRepo.findCurrent(consultationId);

    const note = await this.prisma.$transaction(async (tx) => {
      const created = await this.noteRepo.create(
        { consultationId, ...dto, createdBy: user.id },
        tx,
      );

      await this.consultationRepo.addTimelineEvent(
        {
          consultationId,
          eventType: TimelineEventType.NOTES_UPDATED,
          performedBy: user.id,
          description: `Clinical notes updated to version ${created.version}`,
        },
        tx,
      );

      await this.auditService.log(
        {
          userId: user.id,
          action: AUDIT_ACTIONS.NOTES_UPDATED,
          resourceType: 'ClinicalNote',
          resourceId: created.id,
          oldValue: oldNote ? { version: oldNote.version } : undefined,
          newValue: { version: created.version, consultationId },
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
          correlationId: ctx.correlationId,
          requestId: ctx.requestId,
        },
        tx,
      );

      return created;
    });

    this.logger.log({
      message: 'Clinical notes updated',
      requestId: ctx.requestId,
      userId: user.id,
      consultationId,
      version: note.version,
    });

    return {
      id: note.id,
      version: note.version,
      chiefComplaint: note.chiefComplaint,
      symptoms: note.symptoms,
      diagnosis: note.diagnosis,
      observations: note.observations,
      advice: note.advice,
      followUpInstructions: note.followUpInstructions,
    };
  }
}
