import { Injectable, Inject, LoggerService, HttpStatus } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { PrismaService } from '@database/prisma.service';
import { PaymentStatus, PaymentProviderType, WebhookProcessingStatus } from '@prisma/client';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode, AUDIT_ACTIONS, OUTBOX_EVENTS } from '@common/constants';
import { RequestContext } from '@common/interfaces/api-response.interface';
import { AuditService } from '@modules/audit/application/audit.service';
import { OutboxService } from '@/events/outbox.service';
import { CircuitBreaker } from '@common/utils/circuit-breaker';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
} from '../../domain/interfaces/payment-provider.interface';
import { PaymentRepository } from '../../infrastructure/persistence/payment.repository';
import { InitiatePaymentDto, RefundPaymentDto } from '../dto/payment.dto';

export interface PaymentAuthUser {
  id: string;
  email: string;
  roles: string[];
}

@Injectable()
export class PaymentService {
  private readonly circuitBreaker = new CircuitBreaker();

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentRepo: PaymentRepository,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) {}

  async initiate(user: PaymentAuthUser, dto: InitiatePaymentDto, ctx: RequestContext) {
    const start = Date.now();

    if (dto.idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) return this.paymentRepo.findById(existing.id);
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      include: { doctor: true, patient: true },
    });

    if (!appointment) {
      throw new DomainException(
        ErrorCode.APPOINTMENT_NOT_FOUND,
        'Appointment not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (appointment.patientId !== user.id && !user.roles.includes('Admin')) {
      throw new DomainException(ErrorCode.FORBIDDEN, 'Access denied', HttpStatus.FORBIDDEN);
    }

    const amount = Number(appointment.doctor.consultationFee);

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await this.paymentRepo.create(
        {
          appointmentId: dto.appointmentId,
          patientId: user.id,
          amount,
          currency: 'INR',
          idempotencyKey: dto.idempotencyKey,
        },
        tx,
      );

      const providerResult = await this.circuitBreaker.execute(() =>
        this.provider.initiatePayment({
          paymentId: created.id,
          amount,
          currency: 'INR',
          patientEmail: user.email,
        }),
      );

      const updated = await this.paymentRepo.updateStatus(created.id, PaymentStatus.PENDING, tx, {
        providerRef: providerResult.providerRef,
        provider: PaymentProviderType.MOCK,
      });

      await this.paymentRepo.addAttempt(
        {
          paymentId: created.id,
          attemptNumber: 1,
          status: PaymentStatus.PENDING,
          providerRef: providerResult.providerRef,
        },
        tx,
      );

      await this.auditService.log(
        {
          userId: user.id,
          action: AUDIT_ACTIONS.PAYMENT_INITIATED,
          resourceType: 'Payment',
          resourceId: created.id,
          newValue: { amount, appointmentId: dto.appointmentId },
          ipAddress: ctx.ip,
          correlationId: ctx.correlationId,
          requestId: ctx.requestId,
        },
        tx,
      );

      return { ...updated, checkoutUrl: providerResult.checkoutUrl };
    });

    this.logger.log({
      message: 'Payment initiated',
      requestId: ctx.requestId,
      userId: user.id,
      paymentId: payment.id,
      latency: Date.now() - start,
    });

    return payment;
  }

  async getById(user: PaymentAuthUser, paymentId: string) {
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) {
      throw new DomainException(
        ErrorCode.PAYMENT_NOT_FOUND,
        'Payment not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (payment.patientId !== user.id && !user.roles.includes('Admin')) {
      throw new DomainException(ErrorCode.FORBIDDEN, 'Access denied', HttpStatus.FORBIDDEN);
    }
    return payment;
  }

  async getHistory(user: PaymentAuthUser, limit = 20) {
    return this.paymentRepo.findHistory(user.id, limit);
  }

  async processWebhook(payload: string, signature: string, secret: string) {
    const start = Date.now();
    const parsed = JSON.parse(payload) as { paymentId?: string; providerRef?: string };
    const verification = this.provider.verifyWebhook(payload, signature, secret);

    if (!verification.valid) {
      throw new DomainException(
        ErrorCode.WEBHOOK_VERIFICATION_FAILED,
        'Webhook signature verification failed',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const existingWebhook = await this.prisma.webhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: PaymentProviderType.MOCK,
          providerEventId: verification.providerEventId,
        },
      },
    });

    if (existingWebhook?.status === WebhookProcessingStatus.PROCESSED) {
      return { status: 'DUPLICATE', providerEventId: verification.providerEventId };
    }

    return this.prisma.$transaction(async (tx) => {
      const webhook = await tx.webhookEvent.upsert({
        where: {
          provider_providerEventId: {
            provider: PaymentProviderType.MOCK,
            providerEventId: verification.providerEventId,
          },
        },
        create: {
          provider: PaymentProviderType.MOCK,
          eventType: verification.eventType,
          providerEventId: verification.providerEventId,
          payload: parsed as object,
          signature,
          status: WebhookProcessingStatus.PROCESSING,
        },
        update: { status: WebhookProcessingStatus.PROCESSING },
      });

      const payment = parsed.paymentId
        ? await tx.payment.findUnique({ where: { id: parsed.paymentId } })
        : await this.paymentRepo.findByProviderRef(parsed.providerRef ?? '');

      if (!payment) {
        await tx.webhookEvent.update({
          where: { id: webhook.id },
          data: { status: WebhookProcessingStatus.FAILED, errorMessage: 'Payment not found' },
        });
        throw new DomainException(
          ErrorCode.PAYMENT_NOT_FOUND,
          'Payment not found',
          HttpStatus.NOT_FOUND,
        );
      }

      const captureResult = await this.provider.processCapture(payment.providerRef ?? '');

      if (captureResult.status === 'CAPTURED') {
        await this.paymentRepo.updateStatus(payment.id, PaymentStatus.CAPTURED, tx, {
          capturedAt: new Date(),
        });

        await this.auditService.log(
          {
            action: AUDIT_ACTIONS.PAYMENT_CAPTURED,
            resourceType: 'Payment',
            resourceId: payment.id,
            newValue: { status: PaymentStatus.CAPTURED },
          },
          tx,
        );

        await this.outboxService.store(
          {
            aggregateType: 'Payment',
            aggregateId: payment.id,
            eventType: OUTBOX_EVENTS.PAYMENT_CAPTURED,
            payload: {
              paymentId: payment.id,
              appointmentId: payment.appointmentId,
              patientId: payment.patientId,
              amount: Number(payment.amount),
            },
          },
          tx,
        );
      }

      await tx.webhookEvent.update({
        where: { id: webhook.id },
        data: { status: WebhookProcessingStatus.PROCESSED, processedAt: new Date() },
      });

      this.logger.log({
        message: 'Webhook processed',
        paymentId: payment.id,
        latency: Date.now() - start,
      });

      return { status: 'PROCESSED', paymentId: payment.id };
    });
  }

  async refund(
    user: PaymentAuthUser,
    paymentId: string,
    dto: RefundPaymentDto,
    ctx: RequestContext,
  ) {
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) {
      throw new DomainException(
        ErrorCode.PAYMENT_NOT_FOUND,
        'Payment not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!user.roles.includes('Admin') && payment.patientId !== user.id) {
      throw new DomainException(ErrorCode.FORBIDDEN, 'Access denied', HttpStatus.FORBIDDEN);
    }
    if (payment.status !== PaymentStatus.CAPTURED) {
      throw new DomainException(
        ErrorCode.PAYMENT_FAILED,
        'Only captured payments can be refunded',
        HttpStatus.BAD_REQUEST,
      );
    }

    const refundResult = await this.circuitBreaker.execute(() =>
      this.provider.refund({
        paymentId,
        providerRef: payment.providerRef ?? '',
        amount: dto.amount,
        reason: dto.reason,
      }),
    );

    return this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({
        data: {
          paymentId,
          amount: dto.amount,
          reason: dto.reason,
          status: refundResult.status === 'PROCESSED' ? 'PROCESSED' : 'FAILED',
          providerRef: refundResult.providerRef,
          processedAt: new Date(),
        },
      });

      const newStatus =
        dto.amount >= Number(payment.amount)
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;

      await this.paymentRepo.updateStatus(paymentId, newStatus, tx);

      await this.auditService.log(
        {
          userId: user.id,
          action: AUDIT_ACTIONS.PAYMENT_REFUNDED,
          resourceType: 'Payment',
          resourceId: paymentId,
          newValue: { amount: dto.amount, refundId: refund.id },
          ipAddress: ctx.ip,
          correlationId: ctx.correlationId,
          requestId: ctx.requestId,
        },
        tx,
      );

      return refund;
    });
  }
}
