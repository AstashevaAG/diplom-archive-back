import { Role } from '@prisma/client';
import pdfParse from 'pdf-parse';
import { PrismaService } from '../prisma';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: {
    work: {
      groupBy: jest.Mock;
      count: jest.Mock;
      aggregate: jest.Mock;
    };
    user: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      work: {
        groupBy: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new AnalyticsService(prisma as unknown as PrismaService);
  });

  it('строит тренды по годам и категориям', async () => {
    prisma.work.groupBy.mockResolvedValue([
      { year: 2026, category: 'Психология образования', _count: { id: 8 } },
    ]);

    await expect(service.getTrends()).resolves.toEqual([
      { year: 2026, category: 'Психология образования', count: 8 },
    ]);
    expect(prisma.work.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      by: ['year', 'category'],
      where: { year: { not: null }, category: { not: null } },
    }));
  });

  it('считает статистику преподавателей и округляет средний балл', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'sup-1',
        fullName: 'Анна Петрова',
        worksAsSupervisor: [
          { commissionReviewScore: 87.333 },
          { commissionReviewScore: 92.111 },
          { commissionReviewScore: null },
        ],
      },
    ]);

    await expect(service.getSupervisorStats()).resolves.toEqual([
      { supervisorId: 'sup-1', supervisorName: 'Анна Петрова', totalWorks: 3, avgScore: 89.72 },
    ]);
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { role: Role.SUPERVISOR },
    }));
  });

  it('собирает распределение оценок по пяти диапазонам', async () => {
    prisma.work.count.mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(3).mockResolvedValueOnce(4).mockResolvedValueOnce(5);

    await expect(service.getScoreDistribution()).resolves.toEqual([
      { range: '0-20', count: 1 },
      { range: '21-40', count: 2 },
      { range: '41-60', count: 3 },
      { range: '61-80', count: 4 },
      { range: '81-100', count: 5 },
    ]);
  });

  it('строит dashboard с ключевыми показателями', async () => {
    prisma.work.count
      .mockResolvedValueOnce(18)
      .mockResolvedValueOnce(4);
    prisma.user.count
      .mockResolvedValueOnce(42)
      .mockResolvedValueOnce(6);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.work.groupBy.mockResolvedValue([{ status: 'IN_PROGRESS', _count: { id: 5 } }]);
    prisma.work.aggregate.mockResolvedValue({ _avg: { commissionReviewScore: 86.666 } });

    await expect(service.getDashboard()).resolves.toEqual({
      totalWorks: 18,
      totalUsers: 42,
      totalSupervisors: 6,
      studentsWithoutWorks: 0,
      avgQualityScore: 86.67,
      recentWorks: 4,
      statusRows: [{ status: 'IN_PROGRESS', count: 5 }],
      studentsWithoutWorkRows: [],
    });
  });

  it('формирует CSV-отчёт кафедры с BOM и ключевыми разделами', async () => {
    prisma.work.count
      .mockResolvedValueOnce(18)
      .mockResolvedValueOnce(4);
    prisma.user.count
      .mockResolvedValueOnce(42)
      .mockResolvedValueOnce(6);
    prisma.work.aggregate.mockResolvedValue({ _avg: { commissionReviewScore: 87 } });
    prisma.work.groupBy
      .mockResolvedValueOnce([{ status: 'PUBLISHED', _count: { id: 10 } }])
      .mockResolvedValueOnce([{ status: 'PUBLISHED', _count: { id: 10 } }])
      .mockResolvedValueOnce([{ year: 2026, _count: { id: 8 } }])
      .mockResolvedValueOnce([{ category: 'Психология', _count: { id: 7 } }]);
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: 'student-1', fullName: 'Иван Иванов', email: 'ivan@example.com', group: 'ПС-401' }])
      .mockResolvedValueOnce([
        { id: 'sup-1', fullName: 'Анна Петрова', worksAsSupervisor: [{ commissionReviewScore: 91 }] },
      ]);

    const csv = (await service.buildDepartmentCsvReport()).toString('utf8');

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Отчёт кафедры по архиву ВКР');
    expect(csv).toContain('Статистика преподавателей');
    expect(csv).toContain('Студенты без работы');
    expect(csv).toContain('Анна Петрова');
  });

  it('формирует PDF-отчёт с читаемой кириллицей', async () => {
    prisma.work.count
      .mockResolvedValueOnce(18)
      .mockResolvedValueOnce(4);
    prisma.user.count
      .mockResolvedValueOnce(42)
      .mockResolvedValueOnce(6);
    prisma.work.aggregate.mockResolvedValue({ _avg: { commissionReviewScore: 87 } });
    prisma.work.groupBy
      .mockResolvedValueOnce([{ status: 'PUBLISHED', _count: { id: 10 } }])
      .mockResolvedValueOnce([{ status: 'PUBLISHED', _count: { id: 10 } }])
      .mockResolvedValueOnce([{ year: 2026, _count: { id: 8 } }])
      .mockResolvedValueOnce([{ category: 'Психология', _count: { id: 7 } }]);
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: 'student-1', fullName: 'Иван Иванов', email: 'ivan@example.com', group: 'ПС-401' }])
      .mockResolvedValueOnce([
        { id: 'sup-1', fullName: 'Анна Петрова', worksAsSupervisor: [{ commissionReviewScore: 91 }] },
      ]);

    const pdf = await service.buildDepartmentPdfReport();
    const parsed = await pdfParse(pdf);

    expect(pdf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(parsed.text).toContain('Отчёт кафедры по архиву ВКР');
    expect(parsed.text).toContain('Статистика преподавателей');
    expect(parsed.text).toContain('Анна Петрова');
  });
});
