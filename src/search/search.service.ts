import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { SearchQueryDto, SuggestQueryDto } from './dto';
import { SearchResponse, SearchResult, SuggestResult } from './interfaces';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(dto: SearchQueryDto): Promise<SearchResponse> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const offset = (page - 1) * limit;

    // Build additional filters
    const filters: string[] = ['1=1'];
    const params: (string | number)[] = [dto.q, limit, offset];
    let paramIndex = 4;

    if (dto.year) {
      filters.push(`w.year = $${String(paramIndex)}`);
      params.push(dto.year);
      paramIndex++;
    }
    if (dto.supervisorId) {
      filters.push(`w."supervisorId" = $${String(paramIndex)}`);
      params.push(dto.supervisorId);
      paramIndex++;
    }
    if (dto.category) {
      filters.push(`w.category = $${String(paramIndex)}`);
      params.push(dto.category);
      paramIndex++;
    }
    if (dto.minScore !== undefined) {
      filters.push(`w."qualityScore" >= $${String(paramIndex)}`);
      params.push(dto.minScore);
      paramIndex++;
    }

    const filterClause = filters.join(' AND ');

    const results = await this.prisma.$queryRawUnsafe<SearchResult[]>(
      `
      SELECT
        w.id,
        w.title,
        w.annotation,
        w.category,
        w.tags,
        w.year,
        w."qualityScore" AS "qualityScore",
        u."fullName" AS "authorName",
        s."fullName" AS "supervisorName",
        ts_rank_cd(w.search_vector, plainto_tsquery('russian', $1)) AS rank,
        ts_headline('russian', COALESCE(w.annotation, ''), plainto_tsquery('russian', $1),
          'MaxWords=50, MinWords=20, StartSel=<mark>, StopSel=</mark>'
        ) AS headline
      FROM works w
      JOIN users u ON w."authorId" = u.id
      LEFT JOIN users s ON w."supervisorId" = s.id
      WHERE (
        w.search_vector @@ plainto_tsquery('russian', $1)
        OR similarity(w.title, $1) > 0.2
      )
      AND ${filterClause}
      ORDER BY rank DESC
      LIMIT $2 OFFSET $3
      `,
      ...params,
    );

    const countResult = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `
      SELECT COUNT(*) as count
      FROM works w
      WHERE (
        w.search_vector @@ plainto_tsquery('russian', $1)
        OR similarity(w.title, $1) > 0.2
      )
      AND ${filterClause}
      `,
      ...params.slice(0, 1),
      ...params.slice(3),
    );

    const total = Number(countResult[0]?.count ?? 0);

    return {
      data: results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async suggest(dto: SuggestQueryDto): Promise<SuggestResult[]> {
    const results = await this.prisma.$queryRawUnsafe<SuggestResult[]>(
      `
      SELECT
        id,
        title,
        similarity(title, $1) AS similarity
      FROM works
      WHERE similarity(title, $1) > 0.1
      ORDER BY similarity DESC
      LIMIT 10
      `,
      dto.q,
    );

    return results;
  }
}
