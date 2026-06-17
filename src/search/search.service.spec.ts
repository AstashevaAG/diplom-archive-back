import { PrismaService } from '../prisma';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;
  let prisma: { $queryRawUnsafe: jest.Mock };

  beforeEach(() => {
    prisma = { $queryRawUnsafe: jest.fn() };
    service = new SearchService(prisma as unknown as PrismaService);
  });

  it('возвращает пустой результат без запроса к БД для пустой строки поиска', async () => {
    const result = await service.search({ q: '   ', page: 1, limit: 12 });

    expect(result).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 12,
      totalPages: 0,
    });
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('ищет с вариантами неправильной раскладки и отдаёт convertedQuery для латиницы', async () => {
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ id: 'work-1', title: 'Привет', rank: 3, headline: null }])
      .mockResolvedValueOnce([{ count: BigInt(1) }]);

    const result = await service.search({ q: 'ghbdtn', page: 1, limit: 12, minScore: 70 });

    expect(result).toMatchObject({
      total: 1,
      totalPages: 1,
      convertedQuery: 'привет',
    });
    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('LIMIT $3 OFFSET $4'),
      'ghbdtn',
      'привет',
      12,
      0,
      70,
    );
    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('COUNT(*)'),
      'ghbdtn',
      'привет',
      70,
    );
  });

  it('строит подсказки только по опубликованным публичным работам', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([{ id: 'work-1', title: 'Дипломная работа', similarity: 0.9 }]);

    const result = await service.suggest({ q: 'дипл' });

    expect(result).toEqual([{ id: 'work-1', title: 'Дипломная работа', similarity: 0.9 }]);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('AND ("isPublic" = true OR status = \'PUBLISHED\')'),
      'дипл',
      'lbgk',
    );
  });
});
