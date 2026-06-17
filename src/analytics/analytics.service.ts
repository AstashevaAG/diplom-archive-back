import { Injectable } from '@nestjs/common';
import { Role, WorkStatus } from '@prisma/client';
import { existsSync } from 'node:fs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma';
import {
  TrendItem,
  SupervisorStats,
  ScoreDistribution,
  DashboardData,
} from './interfaces';

interface DepartmentReportData {
  generatedAt: Date;
  dashboard: DashboardData;
  statusRows: { status: string; count: number }[];
  yearRows: { year: number; count: number }[];
  categoryRows: { category: string; count: number }[];
  supervisorRows: SupervisorStats[];
}

const PDF_FONT_CANDIDATES = [
  process.env.PDF_FONT_PATH,
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/System/Library/Fonts/Supplemental/Times New Roman.ttf',
  '/Library/Fonts/Arial.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  'C:\\Windows\\Fonts\\arial.ttf',
].filter((path): path is string => Boolean(path));

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
          select: { commissionReviewScore: true },
        },
      },
    });

    return supervisors.map((s) => {
      const scores = s.worksAsSupervisor
        .map((w) => w.commissionReviewScore)
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
          commissionReviewScore: { gte: r.min, lte: r.max },
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

    const [
      totalWorks,
      totalUsers,
      totalSupervisors,
      studentsWithoutWorkRows,
      statusGroups,
      avgResult,
      recentWorks,
    ] =
      await Promise.all([
        this.prisma.work.count(),
        this.prisma.user.count(),
        this.prisma.user.count({ where: { role: Role.SUPERVISOR } }),
        this.prisma.user.findMany({
          where: {
            role: Role.STUDENT,
            worksAsAuthor: { none: {} },
          },
          select: {
            id: true,
            fullName: true,
            email: true,
            group: true,
          },
          orderBy: { fullName: 'asc' },
        }),
        this.prisma.work.groupBy({
          by: ['status'],
          _count: { id: true },
          where: { status: { not: WorkStatus.ARCHIVED } },
          orderBy: { status: 'asc' },
        }),
        this.prisma.work.aggregate({
          _avg: { commissionReviewScore: true },
          where: { commissionReviewScore: { not: null } },
        }),
        this.prisma.work.count({
          where: { createdAt: { gte: thirtyDaysAgo } },
        }),
      ]);

    return {
      totalWorks,
      totalUsers,
      totalSupervisors,
      studentsWithoutWorks: studentsWithoutWorkRows.length,
      avgQualityScore:
        Math.round((avgResult._avg.commissionReviewScore ?? 0) * 100) / 100,
      recentWorks,
      statusRows: statusGroups.map((row) => ({
        status: row.status,
        count: row._count.id,
      })),
      studentsWithoutWorkRows,
    };
  }

  async buildDepartmentCsvReport(): Promise<Buffer> {
    const data = await this.getDepartmentReportData();
    const lines: string[] = [];
    lines.push(this.csvRow(['Отчёт кафедры по архиву ВКР']));
    lines.push(this.csvRow(['Дата формирования', data.generatedAt.toLocaleString('ru-RU')]));
    lines.push('');
    lines.push(this.csvRow(['Сводка']));
    lines.push(this.csvRow(['Показатель', 'Значение']));
    lines.push(this.csvRow(['Всего работ', String(data.dashboard.totalWorks)]));
    lines.push(this.csvRow(['Пользователей', String(data.dashboard.totalUsers)]));
    lines.push(this.csvRow(['Преподавателей', String(data.dashboard.totalSupervisors)]));
    lines.push(this.csvRow(['Средняя оценка', `${data.dashboard.avgQualityScore}%`]));
    lines.push(this.csvRow(['Новых работ за 30 дней', String(data.dashboard.recentWorks)]));
    lines.push(this.csvRow(['Студентов без работы', String(data.dashboard.studentsWithoutWorks)]));
    lines.push('');
    lines.push(this.csvRow(['Работы по статусам']));
    lines.push(this.csvRow(['Статус', 'Количество']));
    data.statusRows.forEach((row) =>
      lines.push(this.csvRow([row.status, String(row.count)])),
    );
    lines.push('');
    lines.push(this.csvRow(['Студенты без работы']));
    lines.push(this.csvRow(['ФИО', 'Email', 'Группа']));
    data.dashboard.studentsWithoutWorkRows.forEach((student) =>
      lines.push(this.csvRow([student.fullName, student.email, student.group ?? ''])),
    );
    lines.push('');
    lines.push(this.csvRow(['Работы по годам']));
    lines.push(this.csvRow(['Год', 'Количество']));
    data.yearRows.forEach((row) =>
      lines.push(this.csvRow([String(row.year), String(row.count)])),
    );
    lines.push('');
    lines.push(this.csvRow(['Популярные категории']));
    lines.push(this.csvRow(['Категория', 'Количество']));
    data.categoryRows.forEach((row) =>
      lines.push(this.csvRow([row.category, String(row.count)])),
    );
    lines.push('');
    lines.push(this.csvRow(['Статистика преподавателей']));
    lines.push(this.csvRow(['Преподаватель', 'Работ', 'Средняя оценка']));
    data.supervisorRows.forEach((row) =>
      lines.push(
        this.csvRow([
          row.supervisorName,
          String(row.totalWorks),
          row.avgScore > 0 ? `${row.avgScore}%` : '',
        ]),
      ),
    );

    return Buffer.from(`\uFEFF${lines.join('\n')}`, 'utf8');
  }

  async buildDepartmentPdfReport(): Promise<Buffer> {
    const data = await this.getDepartmentReportData();
    const lines = [
      'Отчёт кафедры по архиву ВКР',
      `Дата формирования: ${data.generatedAt.toLocaleString('ru-RU')}`,
      '',
      `Всего работ: ${data.dashboard.totalWorks}`,
      `Пользователей: ${data.dashboard.totalUsers}`,
      `Преподавателей: ${data.dashboard.totalSupervisors}`,
      `Средняя оценка: ${data.dashboard.avgQualityScore}%`,
      `Новых работ за 30 дней: ${data.dashboard.recentWorks}`,
      `Студентов без работы: ${data.dashboard.studentsWithoutWorks}`,
      '',
      'Работы по статусам:',
      ...data.statusRows.map((row) => `- ${row.status}: ${row.count}`),
      '',
      'Студенты без работы:',
      ...data.dashboard.studentsWithoutWorkRows.map((student) =>
        `- ${student.fullName}, ${student.email}${student.group ? `, ${student.group}` : ''}`,
      ),
      '',
      'Работы по годам:',
      ...data.yearRows.map((row) => `- ${row.year}: ${row.count}`),
      '',
      'Популярные категории:',
      ...data.categoryRows.map((row) => `- ${row.category}: ${row.count}`),
      '',
      'Статистика преподавателей:',
      ...data.supervisorRows.map((row) =>
        `- ${row.supervisorName}: ${row.totalWorks} работ, средняя оценка ${row.avgScore > 0 ? `${row.avgScore}%` : 'нет данных'}`,
      ),
    ];

    return this.createSimplePdf(lines);
  }

  private async getDepartmentReportData(): Promise<DepartmentReportData> {
    const [dashboard, statusGroups, yearGroups, categoryGroups, supervisorRows] =
      await Promise.all([
        this.getDashboard(),
        this.prisma.work.groupBy({
          by: ['status'],
          _count: { id: true },
          orderBy: { status: 'asc' },
        }),
        this.prisma.work.groupBy({
          by: ['year'],
          _count: { id: true },
          where: { year: { not: null } },
          orderBy: { year: 'desc' },
        }),
        this.prisma.work.groupBy({
          by: ['category'],
          _count: { id: true },
          where: { category: { not: null } },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),
        this.getSupervisorStats(),
      ]);

    return {
      generatedAt: new Date(),
      dashboard,
      statusRows: statusGroups.map((row) => ({
        status: row.status,
        count: row._count.id,
      })),
      yearRows: yearGroups.map((row) => ({
        year: row.year ?? 0,
        count: row._count.id,
      })),
      categoryRows: categoryGroups.map((row) => ({
        category: row.category ?? 'Без категории',
        count: row._count.id,
      })),
      supervisorRows,
    };
  }

  private csvRow(values: string[]): string {
    return values
      .map((value) => `"${value.replace(/"/g, '""')}"`)
      .join(';');
  }

  private createSimplePdf(lines: string[]): Promise<Buffer> {
    const fontPath = PDF_FONT_CANDIDATES.find((path) => existsSync(path));
    if (!fontPath) {
      throw new Error(
        'Не найден шрифт для PDF-отчёта. Укажите путь к TTF/OTF с кириллицей в PDF_FONT_PATH.',
      );
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 48,
        size: 'A4',
        bufferPages: true,
        info: {
          Title: 'Отчёт кафедры по архиву ВКР',
          Author: 'Diplom Archive',
        },
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('ReportFont', fontPath);
      doc.font('ReportFont').fontSize(15).text(lines[0] ?? 'Отчёт кафедры', {
        align: 'left',
      });
      doc.moveDown(0.5);
      doc.fontSize(10);

      lines.slice(1).forEach((line) => {
        if (!line) {
          doc.moveDown(0.5);
          return;
        }
        const isSectionHeader = !line.includes(':') && !line.startsWith('- ');
        doc
          .fontSize(isSectionHeader ? 12 : 10)
          .text(line, {
            width: 499,
            lineGap: 3,
          });
        if (isSectionHeader) {
          doc.moveDown(0.25);
        }
      });

      doc.end();
    });
  }
}
