import { Module } from '@nestjs/common';
import { SearchService } from './application/services/search.service';

@Module({
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
