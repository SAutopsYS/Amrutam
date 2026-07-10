import {
  InitiatePaymentParams,
  InitiatePaymentResult,
  PaymentProvider,
  RefundParams,
  RefundResult,
  WebhookVerificationResult,
} from '../../domain/interfaces/payment-provider.interface';

/** Razorpay adapter skeleton — implement when integrating real provider. */
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = 'RAZORPAY';

  async initiatePayment(_params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    throw new Error('Razorpay integration not configured');
  }

  verifyWebhook(_payload: string, _signature: string, _secret: string): WebhookVerificationResult {
    return { valid: false, eventType: 'unknown', providerEventId: '' };
  }

  async processCapture(_providerRef: string): Promise<{ status: 'CAPTURED' | 'FAILED' }> {
    return { status: 'FAILED' };
  }

  async refund(_params: RefundParams): Promise<RefundResult> {
    throw new Error('Razorpay integration not configured');
  }
}
