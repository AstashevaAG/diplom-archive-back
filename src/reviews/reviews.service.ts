import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Review } from '@prisma/client';
import { PrismaService } from '../prisma';
import { CreateReviewDto, UpdateReviewDto } from './dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    workId: string,
    reviewerId: string,
    dto: CreateReviewDto,
  ): Promise<Review> {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: {
        id: true,
        title: true,
        authorId: true,
        supervisorId: true,
      },
    });
    if (!work) {
      throw new NotFoundException('Работа не найдена');
    }

    const totalScore = this.calculateScore(dto.criteria, dto.weights);
    const isCommissionReview = work.supervisorId === reviewerId;

    const review = await this.prisma.review.create({
      data: {
        criteria: dto.criteria,
        weights: dto.weights,
        comment: dto.comment,
        totalScore,
        reviewerId,
        workId,
        isCommissionReview,
      },
    });

    // Update work scores: supervisor review, external reviews, and overall average
    await this.updateWorkQualityScore(workId);
    await this.notifyReviewCreated(work, reviewerId, review);

    return review;
  }

  async findByWork(workId: string): Promise<Array<Review & { reviewer: { id: string; fullName: string; role: string }; isCommissionReview: boolean }>> {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: { supervisorId: true },
    });
    if (!work) {
      throw new NotFoundException('Работа не найдена');
    }

    const reviews = await this.prisma.review.findMany({
      where: { workId },
      include: {
        reviewer: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((review) => ({
      ...review,
      isCommissionReview: review.reviewerId === work.supervisorId,
    }));
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

    const criteria = (dto.criteria ?? review.criteria) as Record<string, number>;
    const weights = (dto.weights ?? review.weights) as Record<string, number>;
    const totalScore = this.calculateScore(criteria, weights);

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(dto.criteria !== undefined ? { criteria: dto.criteria } : {}),
        ...(dto.weights !== undefined ? { weights: dto.weights } : {}),
        comment: dto.comment ?? null,
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

  async delete(reviewId: string, userId: string): Promise<void> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, reviewerId: true, workId: true },
    });

    if (!review) {
      throw new NotFoundException('Рецензия не найдена');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (review.reviewerId !== userId && user?.role !== 'ADMIN') {
      throw new ForbiddenException('Нет прав для удаления');
    }

    await this.prisma.review.delete({ where: { id: reviewId } });
    await this.updateWorkQualityScore(review.workId);
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
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: { supervisorId: true },
    });
    if (!work) return;

    const reviews = await this.prisma.review.findMany({ where: { workId } });

    if (reviews.length === 0) {
      await this.prisma.work.update({
        where: { id: workId },
        data: {
          commissionReviewScore: null,
          externalReviewScore: null,
        },
      });
      return;
    }

    const supervisorReviews = reviews.filter(
      (review) => review.reviewerId === work.supervisorId,
    );
    const externalReviews = reviews.filter(
      (review) => review.reviewerId !== work.supervisorId,
    );
    const supervisorAvg =
      supervisorReviews.length > 0
        ? supervisorReviews.reduce((sum, r) => sum + r.totalScore, 0) /
          supervisorReviews.length
        : null;
    const externalAvg =
      externalReviews.length > 0
        ? externalReviews.reduce((sum, r) => sum + r.totalScore, 0) /
          externalReviews.length
        : null;

    await this.prisma.work.update({
      where: { id: workId },
      data: {
        commissionReviewScore:
          supervisorAvg === null ? null : Math.round(supervisorAvg * 100) / 100,
        externalReviewScore:
          externalAvg === null ? null : Math.round(externalAvg * 100) / 100,
      },
    });
  }

  private async notifyReviewCreated(
    work: {
      id: string;
      title: string;
      authorId: string;
      supervisorId: string | null;
    },
    reviewerId: string,
    review: Review,
  ): Promise<void> {
    if (work.authorId === reviewerId) return;

    const reviewer = await this.prisma.user.findUnique({
      where: { id: reviewerId },
      select: { fullName: true },
    });

    await this.notifications.create({
      userId: work.authorId,
      type: 'WORK_REVIEW_CREATED',
      title: 'Получена рецензия',
      message: `${reviewer?.fullName ?? 'Рецензент'} добавил(а) рецензию к работе «${work.title}» с итоговой оценкой ${review.totalScore}%.`,
      data: {
        workId: work.id,
        reviewId: review.id,
        reviewerId,
      },
    });
  }
}
