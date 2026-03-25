import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Review } from '@prisma/client';
import { PrismaService } from '../prisma';
import { CreateReviewDto, UpdateReviewDto } from './dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    workId: string,
    reviewerId: string,
    dto: CreateReviewDto,
  ): Promise<Review> {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) {
      throw new NotFoundException('Работа не найдена');
    }

    const totalScore = this.calculateScore(dto.criteria, dto.weights);

    const review = await this.prisma.review.create({
      data: {
        criteria: dto.criteria,
        weights: dto.weights,
        comment: dto.comment,
        totalScore,
        reviewerId,
        workId,
      },
    });

    // Update work's quality score (average of all reviews)
    await this.updateWorkQualityScore(workId);

    return review;
  }

  async findByWork(workId: string): Promise<Review[]> {
    return this.prisma.review.findMany({
      where: { workId },
      include: {
        reviewer: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    reviewId: string,
    reviewerId: string,
    dto: UpdateReviewDto,
  ): Promise<Review> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Рецензия не найдена');
    }

    if (review.reviewerId !== reviewerId) {
      throw new ForbiddenException('Нет прав для редактирования');
    }

    if (review.isFinalized) {
      throw new ForbiddenException('Рецензия уже финализирована');
    }

    const criteria = (dto.criteria ?? review.criteria) as Record<string, number>;
    const weights = (dto.weights ?? review.weights) as Record<string, number>;
    const totalScore = this.calculateScore(criteria, weights);

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        criteria: dto.criteria ?? undefined,
        weights: dto.weights ?? undefined,
        comment: dto.comment,
        totalScore,
      },
    });

    await this.updateWorkQualityScore(review.workId);

    return updated;
  }

  async finalize(reviewId: string, reviewerId: string): Promise<Review> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Рецензия не найдена');
    }

    if (review.reviewerId !== reviewerId) {
      throw new ForbiddenException('Нет прав для финализации');
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: { isFinalized: true },
    });
  }

  private calculateScore(
    criteria: Record<string, number>,
    weights: Record<string, number>,
  ): number {
    let weightedSum = 0;
    let weightTotal = 0;
    const maxPerCriterion = 10;

    for (const [key, score] of Object.entries(criteria)) {
      const weight = weights[key] ?? 1;
      weightedSum += score * weight;
      weightTotal += maxPerCriterion * weight;
    }

    if (weightTotal === 0) return 0;
    return Math.round((weightedSum / weightTotal) * 100 * 100) / 100;
  }

  private async updateWorkQualityScore(workId: string): Promise<void> {
    const reviews = await this.prisma.review.findMany({
      where: { workId },
    });

    if (reviews.length === 0) return;

    const avgScore =
      reviews.reduce((sum, r) => sum + r.totalScore, 0) / reviews.length;

    await this.prisma.work.update({
      where: { id: workId },
      data: { qualityScore: Math.round(avgScore * 100) / 100 },
    });
  }
}
