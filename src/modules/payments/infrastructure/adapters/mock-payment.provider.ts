import {
  InitiatePaymentParams,
  InitiatePaymentResult,
  PaymentProvider,
  RefundParams,
  RefundResult,
  WebhookVerificationResult,
} from '../../domain/interfaces/payment-provider.interface';

/**
 * Mock payment provider for development and testing.
 * Production deployments swap this adapter via DI without changing business logic.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'MOCK';

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    return {
      providerRef: `mock_${params.paymentId}`,
      status: 'PENDING',
      checkoutUrl: `https://payments.mock/checkout/${params.paymentId}`,
    };
  }

  verifyWebhook(payload: string, signature: string, secret: string): WebhookVerificationResult {
    const expected = `mock_sig_${Buffer.from(payload).toString('base64').slice(0, 16)}`;
    const valid = signature === expected || signature === `sha256=${secret}`;
    return { valid, eventType: 'payment.captured', providerEventId: `evt_${Date.now()}` };
  }

  async processCapture(providerRef: string): Promise<{ status: 'CAPTURED' | 'FAILED' }> {
    return { status: providerRef.startsWith('mock_') ? 'CAPTURED' : 'FAILED' };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    return {
      providerRef: `refund_${params.paymentId}`,
      status: 'PROCESSED',
      amount: params.amount,
    };
  }
}
