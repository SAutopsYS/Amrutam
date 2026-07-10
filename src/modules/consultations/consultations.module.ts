import { Module } from '@nestjs/common';
import { ConsultationsController } from './presentation/consultations.controller';
import {
  StartConsultationService,
  CompleteConsultationService,
  GetConsultationService,
  ClinicalNoteService,
  ConsultationAccessService,
} from './application/services/consultation.services';
import { ConsultationRepository } from './infrastructure/persistence/consultation.repository';
import { ClinicalNoteRepository } from './infrastructure/persistence/clinical-note.repository';

@Module({
  controllers: [ConsultationsController],
  providers: [
    ConsultationRepository,
    ClinicalNoteRepository,
    ConsultationAccessService,
    StartConsultationService,
    CompleteConsultationService,
    GetConsultationService,
    ClinicalNoteService,
  ],
  exports: [ConsultationRepository, ConsultationAccessService],
})
export class ConsultationsModule {}
