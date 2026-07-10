import { Module } from '@nestjs/common';
import { ConsultationsModule } from '@modules/consultations/consultations.module';
import { PrescriptionsController } from './presentation/prescriptions.controller';
import { PrescriptionService } from './application/services/prescription.service';
import { PrescriptionRepository } from './infrastructure/persistence/prescription.repository';

@Module({
  imports: [ConsultationsModule],
  controllers: [PrescriptionsController],
  providers: [PrescriptionRepository, PrescriptionService],
  exports: [PrescriptionRepository, PrescriptionService],
})
export class PrescriptionsModule {}
