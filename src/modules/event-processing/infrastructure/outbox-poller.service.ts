import { Injectable, OnModuleInit, Inject, LoggerService, Optional } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Job } from 'bullmq';
import { PrismaService } from '@database/prisma.service';
import { OutboxEventStatus, NotificationChannel } from '@prisma/client';
import { QUEUE_NAMES, JOB_NAMES, OUTBOX_EVENTS } from '@common/constants';
import { QueueService } from '@/queues/queue.service';
import { MetricsService } from '@/metrics/metrics.service';
import {
  runWithCorrelationAsync,
  getCorrelationContext,
} from '@common/context/correlation.context';
import { NotificationService } from '@modules/notifications/application/services/notification.service';
import { ConsultationRepository } from '@modules/consultations/infrastructure/persistence/consultation.repository';
import { DeadLetterService } from './dead-letter.service';

@Injectable()
export class OutboxPollerService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly notificationService: NotificationService,
    private readonly consultationRepo: ConsultationRepository,
    private readonly deadLetterService: DeadLetterService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  onModuleInit(): void {
    this.queueService.registerWorker(
      QUEUE_NAMES.OUTBOX,
      (job) => this.processOutboxJob(job),
      (job, error) => this.handleFailure(QUEUE_NAMES.OUTBOX, job, error),
    );

    this.queueService.registerWorker(
      QUEUE_NAMES.NOTIFICATIONS,
      (job) => this.processNotificationJob(job),
      (job, error) => this.handleFailure(QUEUE_NAMES.NOTIFICATIONS, job, error),
    );

    this.queueService.registerWorker(
      QUEUE_NAMES.PRESCRIPTION_PDF,
      (job) => this.processPrescriptionPdfJob(job),
      (job, error) => this.handleFailure(QUEUE_NAMES.PRESCRIPTION_PDF, job, error),
    );

    void this.scheduleOutboxPoll();
  }

  private async scheduleOutboxPoll(): Promise<void> {
    setInterval(() => {
      void this.queueService.addJob(QUEUE_NAMES.OUTBOX, JOB_NAMES.POLL_OUTBOX, {});
    }, 5000);
  }

  private async processOutboxJob(job: Job): Promise<void> {
    if (job.name === JOB_NAMES.POLL_OUTBOX) {
      await this.pollOutboxEvents();
      return;
    }
  }

  private async pollOutboxEvents(): Promise<void> {
    const events = await this.prisma.outboxEvent.findMany({
      where: { status: OutboxEventStatus.PENDING },
      take: 50,
      orderBy: { createdAt: 'asc' },
    });

    for (const event of events) {
      try {
        await this.dispatchEvent(event.eventType, event.payload as Record<string, unknown>);

        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: OutboxEventStatus.PUBLISHED, publishedAt: new Date() },
        });
      } catch (error) {
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: OutboxEventStatus.FAILED,
            retryCount: { increment: 1 },
            lastError: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  }

  private async dispatchEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
    switch (eventType) {
      case OUTBOX_EVENTS.APPOINTMENT_BOOKED: {
        await this.consultationRepo.ensureForAppointment(payload.appointmentId as string);
        await this.enqueueNotification(
          payload.patientId as string,
          'Appointment Confirmed',
          'Your appointment has been booked successfully.',
        );
        break;
      }
      case OUTBOX_EVENTS.CONSULTATION_COMPLETED:
        await this.enqueueNotification(
          payload.patientId as string,
          'Consultation Completed',
          'Your consultation has been completed.',
        );
        break;
      case OUTBOX_EVENTS.PRESCRIPTION_CREATED:
        await this.enqueueNotification(
          payload.patientId as string,
          'Prescription Ready',
          'Your prescription is available.',
        );
        await this.queueService.addJob(
          QUEUE_NAMES.PRESCRIPTION_PDF,
          JOB_NAMES.GENERATE_PRESCRIPTION_PDF,
          {
            prescriptionId: payload.prescriptionId,
          },
        );
        break;
      case OUTBOX_EVENTS.PAYMENT_CAPTURED:
        await this.enqueueNotification(
          payload.patientId as string,
          'Payment Successful',
          'Your payment was processed successfully.',
        );
        break;
      default:
        this.logger.log({ message: 'Event dispatched', eventType });
    }
  }

  private async enqueueNotification(userId: string, title: string, body: string): Promise<void> {
    const notification = await this.notificationService.createAndQueue({
      userId,
      channel: NotificationChannel.IN_APP,
      title,
      body,
    });

    await this.queueService.addJob(QUEUE_NAMES.NOTIFICATIONS, JOB_NAMES.SEND_NOTIFICATION, {
      notificationId: notification.id,
      correlationId: getCorrelationContext()?.correlationId,
      requestId: getCorrelationContext()?.requestId,
    });
  }

  private async processNotificationJob(job: Job): Promise<void> {
    const start = Date.now();
    const payload = job.data as {
      notificationId: string;
      correlationId?: string;
      requestId?: string;
    };

    await runWithCorrelationAsync(
      {
        correlationId: payload.correlationId ?? `job-${job.id}`,
        requestId: payload.requestId ?? `job-${job.id}`,
      },
      async () => {
        await this.notificationService.send(payload.notificationId);
      },
    );

    this.metricsService?.recordQueueJob(
      QUEUE_NAMES.NOTIFICATIONS,
      job.name,
      Date.now() - start,
      false,
    );
  }

  private async processPrescriptionPdfJob(job: Job): Promise<void> {
    const { prescriptionId } = job.data as { prescriptionId: string };
    this.logger.log({ message: 'Prescription PDF generation queued', prescriptionId });
  }

  private async handleFailure(
    queueName: string,
    job: Job | undefined,
    error: Error,
  ): Promise<void> {
    const retryCount = job?.attemptsMade ?? 0;
    if (retryCount >= (job?.opts?.attempts ?? 5)) {
      await this.deadLetterService.moveToDeadLetter(
        queueName,
        job?.name ?? 'unknown',
        job?.data ?? {},
        error.message,
        retryCount,
      );
    }
  }
}
