import { Module } from '@nestjs/common';
import { ReviewCriteriaController } from './review-criteria.controller';
import { ReviewCriteriaService } from './review-criteria.service';

@Module({
  controllers: [ReviewCriteriaController],
  providers: [ReviewCriteriaService],
  exports: [ReviewCriteriaService],
})
export class ReviewCriteriaModule {}
