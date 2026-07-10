export interface InitiatePaymentParams {
  paymentId: string;
  amount: number;
  currency: string;
  patientEmail: string;
  metadata?: Record<string, string>;
}

export interface InitiatePaymentResult {
  providerRef: string;
  status: 'PENDING' | 'CREATED';
  checkoutUrl?: string;
}

export interface RefundParams {
  paymentId: string;
  providerRef: string;
  amount: number;
  reason?: string;
}

export interface RefundResult {
  providerRef: string;
  status: 'PROCESSED' | 'FAILED';
  amount: number;
}

export interface WebhookVerificationResult {
  valid: boolean;
  eventType: string;
  providerEventId: string;
}

export interface PaymentProvider {
  readonly name: string;
  initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;
  verifyWebhook(payload: string, signature: string, secret: string): WebhookVerificationResult;
  processCapture(providerRef: string): Promise<{ status: 'CAPTURED' | 'FAILED' }>;
  refund(params: RefundParams): Promise<RefundResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
