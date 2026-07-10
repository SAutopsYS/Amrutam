import { Module } from '@nestjs/common';
import { DoctorsController } from './presentation/doctors.controller';
import { DoctorSearchService } from './application/services/doctor-search.service';
import { AvailabilityService } from './application/services/availability.service';
import { LeaveService } from './application/services/leave.service';

@Module({
  controllers: [DoctorsController],
  providers: [DoctorSearchService, AvailabilityService, LeaveService],
  exports: [DoctorSearchService, AvailabilityService],
})
export class DoctorsModule {}
