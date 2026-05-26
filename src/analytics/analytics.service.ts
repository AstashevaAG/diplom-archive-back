import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
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

    const [totalWorks, totalUsers, totalSupervisors, avgResult, recentWorks] =
      await Promise.all([
        this.prisma.work.count(),
        this.prisma.user.count(),
        this.prisma.user.count({ where: { role: Role.SUPERVISOR } }),
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
      avgQualityScore:
        Math.round((avgResult._avg.commissionReviewScore ?? 0) * 100) / 100,
      recentWorks,
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
    lines.push(this.csvRow(['Руководителей', String(data.dashboard.totalSupervisors)]));
    lines.push(this.csvRow(['Средняя оценка', `${data.dashboard.avgQualityScore}%`]));
    lines.push(this.csvRow(['Новых работ за 30 дней', String(data.dashboard.recentWorks)]));
    lines.push('');
    lines.push(this.csvRow(['Работы по статусам']));
    lines.push(this.csvRow(['Статус', 'Количество']));
    data.statusRows.forEach((row) =>
      lines.push(this.csvRow([row.status, String(row.count)])),
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
    lines.push(this.csvRow(['Статистика руководителей']));
    lines.push(this.csvRow(['Руководитель', 'Работ', 'Средняя оценка']));
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
      `Руководителей: ${data.dashboard.totalSupervisors}`,
      `Средняя оценка: ${data.dashboard.avgQualityScore}%`,
      `Новых работ за 30 дней: ${data.dashboard.recentWorks}`,
      '',
      'Работы по статусам:',
      ...data.statusRows.map((row) => `- ${row.status}: ${row.count}`),
      '',
      'Работы по годам:',
      ...data.yearRows.map((row) => `- ${row.year}: ${row.count}`),
      '',
      'Популярные категории:',
      ...data.categoryRows.map((row) => `- ${row.category}: ${row.count}`),
      '',
      'Статистика руководителей:',
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

  private createSimplePdf(lines: string[]): Buffer {
    const wrappedLines = lines.flatMap((line) => this.wrapPdfLine(line, 86));
    const pageSize = 42;
    const pages: string[][] = [];
    for (let i = 0; i < wrappedLines.length; i += pageSize) {
      pages.push(wrappedLines.slice(i, i + pageSize));
    }
    if (pages.length === 0) pages.push(['Отчёт пуст']);

    const objects: string[] = [];
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

    const pageIds: number[] = [];
    let nextObjectId = 4;
    for (const pageLines of pages) {
      const content = pageLines
        .map((line, index) => {
          const y = 800 - index * 17;
          return `BT /F1 10 Tf 48 ${y} Td <${this.toPdfUtf16Hex(line)}> Tj ET`;
        })
        .join('\n');
      const contentId = nextObjectId;
      nextObjectId += 1;
      const pageId = nextObjectId;
      nextObjectId += 1;
      objects[contentId] =
        `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`;
      objects[pageId] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
      pageIds.push(pageId);
    }

    objects[2] =
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];
    for (let id = 1; id < objects.length; id += 1) {
      offsets[id] = Buffer.byteLength(pdf, 'utf8');
      pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xrefStart = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id += 1) {
      pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    return Buffer.from(pdf, 'utf8');
  }

  private wrapPdfLine(line: string, maxLength: number): string[] {
    if (!line) return [''];
    const words = line.split(' ');
    const result: string[] = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxLength && current) {
        result.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) result.push(current);
    return result;
  }

  private toPdfUtf16Hex(text: string): string {
    const buffer = Buffer.alloc(2 + text.length * 2);
    buffer[0] = 0xfe;
    buffer[1] = 0xff;
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      buffer[2 + i * 2] = code >> 8;
      buffer[3 + i * 2] = code & 0xff;
    }
    return buffer.toString('hex').toUpperCase();
  }
}
