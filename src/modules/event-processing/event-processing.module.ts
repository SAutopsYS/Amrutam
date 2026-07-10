import { Module } from '@nestjs/common';
import { ConsultationsModule } from '@modules/consultations/consultations.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { QueueModule } from '@/queues/queue.module';
import { OutboxPollerService } from './infrastructure/outbox-poller.service';
import { DeadLetterService } from './infrastructure/dead-letter.service';

@Module({
  imports: [QueueModule, ConsultationsModule, NotificationsModule],
  providers: [OutboxPollerService, DeadLetterService],
  exports: [DeadLetterService, OutboxPollerService],
})
export class EventProcessingModule {}
