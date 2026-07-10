import { MockPaymentProvider } from '../../src/modules/payments/infrastructure/adapters/mock-payment.provider';

describe('MockPaymentProvider', () => {
  const provider = new MockPaymentProvider();

  it('initiates payment with mock ref', async () => {
    const result = await provider.initiatePayment({
      paymentId: 'pay-1',
      amount: 500,
      currency: 'INR',
      patientEmail: 'test@test.com',
    });
    expect(result.providerRef).toBe('mock_pay-1');
    expect(result.status).toBe('PENDING');
  });

  it('verifies webhook signature', () => {
    const payload = JSON.stringify({ paymentId: 'pay-1' });
    const sig = `mock_sig_${Buffer.from(payload).toString('base64').slice(0, 16)}`;
    const result = provider.verifyWebhook(payload, sig, 'secret');
    expect(result.valid).toBe(true);
  });

  it('rejects invalid webhook signature', () => {
    const result = provider.verifyWebhook('{}', 'invalid', 'secret');
    expect(result.valid).toBe(false);
  });
});
