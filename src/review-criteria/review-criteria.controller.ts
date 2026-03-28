import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReviewCriteriaConfig } from '@prisma/client';
import { ReviewCriteriaService } from './review-criteria.service';

@ApiTags('Review Criteria')
@Controller('review-criteria')
export class ReviewCriteriaController {
  constructor(private readonly reviewCriteriaService: ReviewCriteriaService) {}

  @Get()
  @ApiOperation({ summary: 'Список критериев оценки работ' })
  async findAll(): Promise<ReviewCriteriaConfig[]> {
    return this.reviewCriteriaService.findAll();
  }
}
