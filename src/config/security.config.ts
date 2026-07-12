import { registerAs } from '@nestjs/config';

export default registerAs('security', () => ({
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
  passwordHistoryCount: parseInt(process.env.PASSWORD_HISTORY_COUNT ?? '5', 10),
  mfaEnabled: process.env.MFA_ENABLED === 'true',
  mfaEncryptionKey: process.env.MFA_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET || '',
  bookingCancellationHours: parseInt(process.env.BOOKING_CANCELLATION_HOURS ?? '24', 10),
  maxPayloadSize: process.env.MAX_PAYLOAD_SIZE ?? '1mb',
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET,
}));
