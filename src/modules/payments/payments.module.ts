import { Module } from '@nestjs/common';
import { MockPaymentProvider } from './infrastructure/adapters/mock-payment.provider';
import { PAYMENT_PROVIDER } from './domain/interfaces/payment-provider.interface';
import { PaymentRepository } from './infrastructure/persistence/payment.repository';
import { PaymentService } from './application/services/payment.service';
import { PaymentsController } from './presentation/payments.controller';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentRepository,
    PaymentService,
    { provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider },
  ],
  exports: [PaymentService, PaymentRepository],
})
export class PaymentsModule {}
