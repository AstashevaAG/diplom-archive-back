import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { User, Review } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('works/:workId/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Создать рецензию' })
  async create(
    @Param('workId') workId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: User,
  ): Promise<Review> {
    return this.reviewsService.create(workId, user.id, dto);
  }

  @Get('works/:workId/reviews')
  @ApiOperation({ summary: 'Рецензии на работу' })
  async findByWork(@Param('workId') workId: string): Promise<Review[]> {
    return this.reviewsService.findByWork(workId);
  }

  @Patch('reviews/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновить рецензию' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
    @CurrentUser() user: User,
  ): Promise<Review> {
    return this.reviewsService.update(id, user.id, dto);
  }

  @Delete('reviews/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Удалить рецензию' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.reviewsService.delete(id, user.id);
  }

  @Post('reviews/:id/finalize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Финализировать рецензию' })
  async finalize(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<Review> {
    return this.reviewsService.finalize(id, user.id);
  }
}
