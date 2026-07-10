import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import {
  NOTIFICATION_PROVIDER,
  NotificationProvider,
} from '../../domain/interfaces/notification-provider.interface';
import { CircuitBreaker } from '@common/utils/circuit-breaker';

@Injectable()
export class NotificationService {
  private readonly circuitBreaker = new CircuitBreaker();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_PROVIDER) private readonly provider: NotificationProvider,
  ) {}

  async createAndQueue(params: {
    userId: string;
    channel: NotificationChannel;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: params.userId,
        channel: params.channel,
        title: params.title,
        body: params.body,
        status: NotificationStatus.QUEUED,
        metadata: params.metadata as object | undefined,
      },
    });
  }

  async send(notificationId: string) {
    const notification = await this.prisma.notification.findUniqueOrThrow({
      where: { id: notificationId },
    });

    const attemptNumber =
      (await this.prisma.notificationHistory.count({ where: { notificationId } })) + 1;

    try {
      const result = await this.circuitBreaker.execute(() =>
        this.provider.send({
          userId: notification.userId,
          channel: notification.channel,
          title: notification.title,
          body: notification.body,
          metadata: notification.metadata as Record<string, unknown> | undefined,
        }),
      );

      await this.prisma.$transaction([
        this.prisma.notification.update({
          where: { id: notificationId },
          data: {
            status: result.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
            sentAt: result.success ? new Date() : undefined,
          },
        }),
        this.prisma.notificationHistory.create({
          data: {
            notificationId,
            status: result.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
            attemptNumber,
            errorMessage: result.error,
          },
        }),
      ]);

      return result;
    } catch (error) {
      await this.prisma.notificationHistory.create({
        data: {
          notificationId,
          status: NotificationStatus.FAILED,
          attemptNumber,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  async getUserNotifications(userId: string, limit = 20) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
  }
}
