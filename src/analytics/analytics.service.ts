import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma';
import {
  TrendItem,
  SupervisorStats,
  ScoreDistribution,
  DashboardData,
} from './interfaces';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrends(): Promise<TrendItem[]> {
    const works = await this.prisma.work.groupBy({
      by: ['year', 'category'],
      _count: { id: true },
      where: { year: { not: null }, category: { not: null } },
      orderBy: { year: 'desc' },
    });

    return works.map((w) => ({
      year: w.year ?? 0,
      category: w.category ?? '',
      count: w._count.id,
    }));
  }

  async getSupervisorStats(): Promise<SupervisorStats[]> {
    const supervisors = await this.prisma.user.findMany({
      where: { role: Role.SUPERVISOR },
      select: {
        id: true,
        fullName: true,
        worksAsSupervisor: {
          select: { qualityScore: true },
        },
      },
    });

    return supervisors.map((s) => {
      const scores = s.worksAsSupervisor
        .map((w) => w.qualityScore)
        .filter((score): score is number => score !== null);

      const avgScore =
        scores.length > 0
          ? Math.round(
              (scores.reduce((sum, sc) => sum + sc, 0) / scores.length) * 100,
            ) / 100
          : 0;

      return {
        supervisorId: s.id,
        supervisorName: s.fullName,
        totalWorks: s.worksAsSupervisor.length,
        avgScore,
      };
    });
  }

  async getScoreDistribution(): Promise<ScoreDistribution[]> {
    const ranges = [
      { range: '0-20', min: 0, max: 20 },
      { range: '21-40', min: 21, max: 40 },
      { range: '41-60', min: 41, max: 60 },
      { range: '61-80', min: 61, max: 80 },
      { range: '81-100', min: 81, max: 100 },
    ];

    const results: ScoreDistribution[] = [];
    for (const r of ranges) {
      const count = await this.prisma.work.count({
        where: {
          qualityScore: { gte: r.min, lte: r.max },
        },
      });
      results.push({ range: r.range, count });
    }

    return results;
  }

  async getPopularCategories(): Promise<{ category: string; count: number }[]> {
    const cats = await this.prisma.work.groupBy({
      by: ['category'],
      _count: { id: true },
      where: { category: { not: null } },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    return cats.map((c) => ({
      category: c.category ?? '',
      count: c._count.id,
    }));
  }

  async getDashboard(): Promise<DashboardData> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalWorks, totalUsers, totalSupervisors, avgResult, recentWorks] =
      await Promise.all([
        this.prisma.work.count(),
        this.prisma.user.count(),
        this.prisma.user.count({ where: { role: Role.SUPERVISOR } }),
        this.prisma.work.aggregate({
          _avg: { qualityScore: true },
          where: { qualityScore: { not: null } },
        }),
        this.prisma.work.count({
          where: { createdAt: { gte: thirtyDaysAgo } },
        }),
      ]);

    return {
      totalWorks,
      totalUsers,
      totalSupervisors,
      avgQualityScore:
        Math.round((avgResult._avg.qualityScore ?? 0) * 100) / 100,
      recentWorks,
    };
  }
}
