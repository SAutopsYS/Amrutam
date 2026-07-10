import {
  NotificationProvider,
  SendNotificationParams,
} from '../../domain/interfaces/notification-provider.interface';

/** In-app / mock notification provider — no external integration. */
export class MockNotificationProvider implements NotificationProvider {
  readonly name = 'MOCK';

  async send(params: SendNotificationParams): Promise<{ success: boolean; providerRef?: string }> {
    return { success: true, providerRef: `notif_${params.userId}_${Date.now()}` };
  }
}
