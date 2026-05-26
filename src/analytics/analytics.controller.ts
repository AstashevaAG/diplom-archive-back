import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import {
  TrendItem,
  SupervisorStats,
  ScoreDistribution,
  DashboardData,
} from './interfaces';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('trends')
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  @ApiOperation({ summary: 'Тренды тем ВКР по годам' })
  async getTrends(): Promise<TrendItem[]> {
    return this.analyticsService.getTrends();
  }

  @Get('supervisors')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Статистика по руководителям' })
  async getSupervisorStats(): Promise<SupervisorStats[]> {
    return this.analyticsService.getSupervisorStats();
  }

  @Get('scores')
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  @ApiOperation({ summary: 'Распределение оценок' })
  async getScoreDistribution(): Promise<ScoreDistribution[]> {
    return this.analyticsService.getScoreDistribution();
  }

  @Get('categories')
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  @ApiOperation({ summary: 'Популярные категории' })
  async getPopularCategories(): Promise<{ category: string; count: number }[]> {
    return this.analyticsService.getPopularCategories();
  }

  @Get('dashboard')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Сводный дашборд' })
  async getDashboard(): Promise<DashboardData> {
    return this.analyticsService.getDashboard();
  }

  @Get('reports/department.csv')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Экспорт отчёта кафедры в CSV для Excel' })
  async exportDepartmentCsv(@Res() res: Response): Promise<void> {
    const buffer = await this.analyticsService.buildDepartmentCsvReport();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="department-report.csv"',
    );
    res.send(buffer);
  }

  @Get('reports/department.pdf')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Экспорт отчёта кафедры в PDF' })
  async exportDepartmentPdf(@Res() res: Response): Promise<void> {
    const buffer = await this.analyticsService.buildDepartmentPdfReport();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="department-report.pdf"',
    );
    res.send(buffer);
  }
}
