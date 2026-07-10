import { Module } from '@nestjs/common';
import { AnalyticsModule } from '@modules/analytics/analytics.module';
import { SearchModule } from '@modules/search/search.module';
import { EventProcessingModule } from '@modules/event-processing/event-processing.module';
import { DashboardService } from './application/services/dashboard.service';
import { AdminController } from './presentation/admin.controller';

@Module({
  imports: [AnalyticsModule, SearchModule, EventProcessingModule],
  controllers: [AdminController],
  providers: [DashboardService],
})
export class AdminModule {}
