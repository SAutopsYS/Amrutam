import { Module } from '@nestjs/common';
import { MockNotificationProvider } from './infrastructure/adapters/mock-notification.provider';
import { NOTIFICATION_PROVIDER } from './domain/interfaces/notification-provider.interface';
import { NotificationService } from './application/services/notification.service';
import { NotificationsController } from './presentation/notifications.controller';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationService,
    { provide: NOTIFICATION_PROVIDER, useClass: MockNotificationProvider },
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
