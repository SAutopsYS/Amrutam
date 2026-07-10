export interface SendNotificationParams {
  userId: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP' | 'IN_APP';
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationProvider {
  readonly name: string;
  send(
    params: SendNotificationParams,
  ): Promise<{ success: boolean; providerRef?: string; error?: string }>;
}

export const NOTIFICATION_PROVIDER = Symbol('NOTIFICATION_PROVIDER');
