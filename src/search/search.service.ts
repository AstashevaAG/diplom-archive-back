import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { SearchQueryDto, SuggestQueryDto } from './dto';
import { SearchResponse, SearchResult, SuggestResult } from './interfaces';

const EN_TO_RU: Record<string, string> = {
  q: 'й', w: 'ц', e: 'у', r: 'к', t: 'е', y: 'н', u: 'г', i: 'ш', o: 'щ', p: 'з',
  '[': 'х', ']': 'ъ', a: 'ф', s: 'ы', d: 'в', f: 'а', g: 'п', h: 'р', j: 'о', k: 'л',
  l: 'д', ';': 'ж', "'": 'э', z: 'я', x: 'ч', c: 'с', v: 'м', b: 'и', n: 'т', m: 'ь',
  ',': 'б', '.': 'ю',
};

const RU_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_RU).map(([k, v]) => [v, k]),
);

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  private convertLayout(text: string, map: Record<string, string>): string {
    return text
      .split('')
      .map((ch) => map[ch.toLowerCase()] ?? ch)
      .join('');
  }

  private hasLatinChars(text: string): boolean {
    return /[a-zA-Z]/.test(text);
  }

  private hasCyrillicChars(text: string): boolean {
    return /[а-яёА-ЯЁ]/.test(text);
  }

  private getSearchVariants(q: string): string[] {
    const variants = [q];
    if (this.hasLatinChars(q)) {
      variants.push(this.convertLayout(q, EN_TO_RU));
    }
    if (this.hasCyrillicChars(q)) {
      variants.push(this.convertLayout(q, RU_TO_EN));
    }
    return [...new Set(variants)];
  }

  async search(dto: SearchQueryDto): Promise<SearchResponse> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const offset = (page - 1) * limit;

    const variants = this.getSearchVariants(dto.q);
    const primaryQuery = variants[0];
    const altQuery = variants[1] ?? variants[0];

    const filters: string[] = ['1=1'];
    const params: (string | number)[] = [primaryQuery, altQuery, limit, offset];
    let paramIndex = 5;

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
        COALESCE(w.tags, ARRAY[]::text[]) AS tags,
        w.year,
        w."qualityScore" AS "qualityScore",
        u."fullName" AS "authorName",
        s."fullName" AS "supervisorName",
        GREATEST(
          ts_rank_cd(w.search_vector, plainto_tsquery('russian', $1)),
          ts_rank_cd(w.search_vector, plainto_tsquery('russian', $2)),
          similarity(w.title, $1),
          similarity(w.title, $2)
        ) AS rank,
        ts_headline('russian',
          COALESCE(w.annotation, ''),
          plainto_tsquery('russian', $1),
          'MaxWords=50, MinWords=20, StartSel=<mark>, StopSel=</mark>'
        ) AS headline
      FROM works w
      JOIN users u ON w."authorId" = u.id
      LEFT JOIN users s ON w."supervisorId" = s.id
      WHERE (
        w.search_vector @@ plainto_tsquery('russian', $1)
        OR w.search_vector @@ plainto_tsquery('russian', $2)
        OR similarity(w.title, $1) > 0.15
        OR similarity(w.title, $2) > 0.15
        OR w.title ILIKE '%' || $1 || '%'
        OR w.title ILIKE '%' || $2 || '%'
        OR w.annotation ILIKE '%' || $1 || '%'
        OR w.annotation ILIKE '%' || $2 || '%'
      )
      AND (w."isPublic" = true OR w.status = 'PUBLISHED')
      AND ${filterClause}
      ORDER BY rank DESC
      LIMIT $3 OFFSET $4
      `,
      ...params,
    );

    const countResult = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `
      SELECT COUNT(*) as count
      FROM works w
      WHERE (
        w.search_vector @@ plainto_tsquery('russian', $1)
        OR w.search_vector @@ plainto_tsquery('russian', $2)
        OR similarity(w.title, $1) > 0.15
        OR similarity(w.title, $2) > 0.15
        OR w.title ILIKE '%' || $1 || '%'
        OR w.title ILIKE '%' || $2 || '%'
        OR w.annotation ILIKE '%' || $1 || '%'
        OR w.annotation ILIKE '%' || $2 || '%'
      )
      AND (w."isPublic" = true OR w.status = 'PUBLISHED')
      AND ${filterClause}
      `,
      ...params.slice(0, 2),
      ...params.slice(4),
    );

    const total = Number(countResult[0]?.count ?? 0);

    return {
      data: results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      convertedQuery: variants.length > 1 ? altQuery : undefined,
    };
  }

  async suggest(dto: SuggestQueryDto): Promise<SuggestResult[]> {
    const variants = this.getSearchVariants(dto.q);
    const primary = variants[0];
    const alt = variants[1] ?? variants[0];

    const results = await this.prisma.$queryRawUnsafe<SuggestResult[]>(
      `
      SELECT
        id,
        title,
        GREATEST(
          similarity(title, $1),
          similarity(title, $2)
        ) AS similarity
      FROM works
      WHERE (
        similarity(title, $1) > 0.08
        OR similarity(title, $2) > 0.08
        OR title ILIKE '%' || $1 || '%'
        OR title ILIKE '%' || $2 || '%'
      )
      AND ("isPublic" = true OR status = 'PUBLISHED')
      ORDER BY similarity DESC
      LIMIT 10
      `,
      primary,
      alt,
    );

    return results;
  }
}
