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

interface SqlFilter {
  clause: string;
  params: Array<string | number>;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeSqlText(expression: string): string {
    return `lower(translate(${expression}, 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'))`;
  }

  private normalizeQuery(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private addYoVariant(text: string): string {
    return text.replace(/ё/g, 'е').replace(/Ё/g, 'Е');
  }

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
    const normalized = this.normalizeQuery(q);
    const variants = [normalized, this.addYoVariant(normalized)];
    if (this.hasLatinChars(normalized)) {
      variants.push(this.convertLayout(normalized, EN_TO_RU));
    }
    if (this.hasCyrillicChars(normalized)) {
      variants.push(this.convertLayout(normalized, RU_TO_EN));
    }
    return [...new Set(variants.map((v) => this.normalizeQuery(v)).filter(Boolean))];
  }

  private buildFilters(dto: SearchQueryDto, startIndex: number): SqlFilter {
    const filters: string[] = ['1=1'];
    const params: Array<string | number> = [];
    let paramIndex = startIndex;

    if (dto.year) {
      filters.push(`sw.year = $${String(paramIndex)}`);
      params.push(dto.year);
      paramIndex++;
    }
    if (dto.supervisorId) {
      filters.push(`sw."supervisorId" = $${String(paramIndex)}`);
      params.push(dto.supervisorId);
      paramIndex++;
    }
    if (dto.category) {
      filters.push(`sw.category = $${String(paramIndex)}`);
      params.push(dto.category);
      paramIndex++;
    }
    if (dto.minScore !== undefined) {
      filters.push(`sw."commissionReviewScore" >= $${String(paramIndex)}`);
      params.push(dto.minScore);
      paramIndex++;
    }

    return { clause: filters.join(' AND '), params };
  }

  private searchableWorksCte(): string {
    return `
      WITH searchable_works AS (
        SELECT
          w.id,
          w.title,
          w.description,
          w.annotation,
          w.category,
          COALESCE(w.tags, ARRAY[]::text[]) AS tags,
          w.year,
          w."supervisorReviewScore" AS "commissionReviewScore",
          w."supervisorId",
          w.status,
          w."isPublic",
          u."fullName" AS "authorName",
          s."fullName" AS "supervisorName",
          array_to_string(COALESCE(w.tags, ARRAY[]::text[]), ' ') AS tags_text,
          COALESCE(w."fullText", '') AS file_text,
          concat_ws(
            E'\\n\\n',
            w.title,
            w.description,
            w.annotation,
            w.category,
            array_to_string(COALESCE(w.tags, ARRAY[]::text[]), ' '),
            u."fullName",
            s."fullName",
            w.year::text,
            w."fullText"
          ) AS document_text,
          (
            setweight(to_tsvector('russian', concat_ws(' ', COALESCE(w.title, ''), COALESCE(array_to_string(w.tags, ' '), ''), COALESCE(w.category, ''))), 'A') ||
            setweight(to_tsvector('russian', concat_ws(' ', COALESCE(w.description, ''), COALESCE(w.annotation, ''), COALESCE(u."fullName", ''), COALESCE(s."fullName", ''), COALESCE(w.year::text, ''))), 'B') ||
            setweight(to_tsvector('russian', COALESCE(w."fullText", '')), 'C')
          ) AS document_vector
        FROM works w
        JOIN users u ON w."authorId" = u.id
        LEFT JOIN users s ON w."supervisorId" = s.id
      )
    `;
  }

  private buildMatchCondition(queryRefs: string[]): string {
    const perVariant = queryRefs.map(
      (ref) => `
        sw.document_vector @@ websearch_to_tsquery('russian', ${this.normalizeSqlText(ref)})
        OR ${this.normalizeSqlText('sw.title')} LIKE '%' || ${this.normalizeSqlText(ref)} || '%'
        OR ${this.normalizeSqlText("COALESCE(sw.description, '')")} LIKE '%' || ${this.normalizeSqlText(ref)} || '%'
        OR ${this.normalizeSqlText("COALESCE(sw.annotation, '')")} LIKE '%' || ${this.normalizeSqlText(ref)} || '%'
        OR ${this.normalizeSqlText("COALESCE(sw.category, '')")} LIKE '%' || ${this.normalizeSqlText(ref)} || '%'
        OR ${this.normalizeSqlText("COALESCE(sw.tags_text, '')")} LIKE '%' || ${this.normalizeSqlText(ref)} || '%'
        OR ${this.normalizeSqlText('COALESCE(sw."authorName", \'\')')} LIKE '%' || ${this.normalizeSqlText(ref)} || '%'
        OR ${this.normalizeSqlText('COALESCE(sw."supervisorName", \'\')')} LIKE '%' || ${this.normalizeSqlText(ref)} || '%'
        OR ${this.normalizeSqlText("COALESCE(sw.year::text, '')")} LIKE '%' || ${this.normalizeSqlText(ref)} || '%'
        OR ${this.normalizeSqlText('sw.file_text')} LIKE '%' || ${this.normalizeSqlText(ref)} || '%'
        OR similarity(${this.normalizeSqlText('sw.title')}, ${this.normalizeSqlText(ref)}) > 0.12
        OR similarity(${this.normalizeSqlText("COALESCE(sw.description, '')")}, ${this.normalizeSqlText(ref)}) > 0.08
        OR similarity(${this.normalizeSqlText("COALESCE(sw.annotation, '')")}, ${this.normalizeSqlText(ref)}) > 0.08
        OR similarity(${this.normalizeSqlText("COALESCE(sw.category, '')")}, ${this.normalizeSqlText(ref)}) > 0.08
        OR similarity(${this.normalizeSqlText("COALESCE(sw.tags_text, '')")}, ${this.normalizeSqlText(ref)}) > 0.08
        OR similarity(${this.normalizeSqlText('COALESCE(sw."authorName", \'\')')}, ${this.normalizeSqlText(ref)}) > 0.08
        OR similarity(${this.normalizeSqlText('COALESCE(sw."supervisorName", \'\')')}, ${this.normalizeSqlText(ref)}) > 0.08
      `,
    );

    return perVariant.map((condition) => `(${condition})`).join(' OR ');
  }

  private buildRankExpression(queryRefs: string[]): string {
    const ranks = queryRefs.flatMap((ref) => [
      `ts_rank_cd(sw.document_vector, websearch_to_tsquery('russian', ${this.normalizeSqlText(ref)}))`,
      `CASE WHEN ${this.normalizeSqlText('sw.title')} LIKE '%' || ${this.normalizeSqlText(ref)} || '%' THEN 3 ELSE 0 END`,
      `CASE WHEN ${this.normalizeSqlText("COALESCE(sw.description, '')")} LIKE '%' || ${this.normalizeSqlText(ref)} || '%' THEN 2 ELSE 0 END`,
      `CASE WHEN ${this.normalizeSqlText("COALESCE(sw.annotation, '')")} LIKE '%' || ${this.normalizeSqlText(ref)} || '%' THEN 2 ELSE 0 END`,
      `CASE WHEN ${this.normalizeSqlText("COALESCE(sw.category, '')")} LIKE '%' || ${this.normalizeSqlText(ref)} || '%' THEN 1.8 ELSE 0 END`,
      `CASE WHEN ${this.normalizeSqlText("COALESCE(sw.tags_text, '')")} LIKE '%' || ${this.normalizeSqlText(ref)} || '%' THEN 1.8 ELSE 0 END`,
      `CASE WHEN ${this.normalizeSqlText('COALESCE(sw."authorName", \'\')')} LIKE '%' || ${this.normalizeSqlText(ref)} || '%' THEN 1.7 ELSE 0 END`,
      `CASE WHEN ${this.normalizeSqlText('COALESCE(sw."supervisorName", \'\')')} LIKE '%' || ${this.normalizeSqlText(ref)} || '%' THEN 1.7 ELSE 0 END`,
      `CASE WHEN ${this.normalizeSqlText("COALESCE(sw.file_text, '')")} LIKE '%' || ${this.normalizeSqlText(ref)} || '%' THEN 1.2 ELSE 0 END`,
      `similarity(${this.normalizeSqlText('sw.title')}, ${this.normalizeSqlText(ref)})`,
      `similarity(${this.normalizeSqlText("COALESCE(sw.description, '')")}, ${this.normalizeSqlText(ref)}) * 0.8`,
      `similarity(${this.normalizeSqlText("COALESCE(sw.annotation, '')")}, ${this.normalizeSqlText(ref)}) * 0.8`,
      `similarity(${this.normalizeSqlText("COALESCE(sw.category, '')")}, ${this.normalizeSqlText(ref)}) * 0.7`,
      `similarity(${this.normalizeSqlText("COALESCE(sw.tags_text, '')")}, ${this.normalizeSqlText(ref)}) * 0.7`,
      `similarity(${this.normalizeSqlText('COALESCE(sw."authorName", \'\')')}, ${this.normalizeSqlText(ref)}) * 0.7`,
      `similarity(${this.normalizeSqlText('COALESCE(sw."supervisorName", \'\')')}, ${this.normalizeSqlText(ref)}) * 0.7`,
    ]);

    return `GREATEST(${ranks.join(', ')})`;
  }

  private buildHeadlineQuery(queryRefs: string[]): string {
    return queryRefs
      .map((ref) => `websearch_to_tsquery('russian', ${this.normalizeSqlText(ref)})`)
      .join(' || ');
  }

  async search(dto: SearchQueryDto): Promise<SearchResponse> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const offset = (page - 1) * limit;

    const variants = this.getSearchVariants(dto.q);
    if (variants.length === 0) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    const queryRefs = variants.map((_, index) => `$${String(index + 1)}`);
    const limitIndex = variants.length + 1;
    const offsetIndex = variants.length + 2;
    const searchFilter = this.buildFilters(dto, variants.length + 3);
    const countFilter = this.buildFilters(dto, variants.length + 1);
    const matchCondition = this.buildMatchCondition(queryRefs);
    const rankExpression = this.buildRankExpression(queryRefs);
    const headlineQuery = this.buildHeadlineQuery(queryRefs);

    const results = await this.prisma.$queryRawUnsafe<SearchResult[]>(
      `
      ${this.searchableWorksCte()}
      SELECT
        sw.id,
        sw.title,
        sw.description,
        sw.annotation,
        sw.category,
        sw.tags,
        sw.year,
        sw."commissionReviewScore",
        sw."authorName",
        sw."supervisorName",
        ${rankExpression} AS rank,
        ts_headline('russian',
          sw.document_text,
          ${headlineQuery},
          'MaxWords=50, MinWords=20, StartSel=<mark>, StopSel=</mark>'
        ) AS headline
      FROM searchable_works sw
      WHERE (${matchCondition})
      AND (sw."isPublic" = true OR sw.status = 'PUBLISHED')
      AND ${searchFilter.clause}
      ORDER BY rank DESC
      LIMIT $${String(limitIndex)} OFFSET $${String(offsetIndex)}
      `,
      ...variants,
      limit,
      offset,
      ...searchFilter.params,
    );

    const countResult = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `
      ${this.searchableWorksCte()}
      SELECT COUNT(*) as count
      FROM searchable_works sw
      WHERE (${matchCondition})
      AND (sw."isPublic" = true OR sw.status = 'PUBLISHED')
      AND ${countFilter.clause}
      `,
      ...variants,
      ...countFilter.params,
    );

    const total = Number(countResult[0]?.count ?? 0);

    return {
      data: results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      convertedQuery: this.hasLatinChars(variants[0])
        ? variants.find((variant) => variant !== variants[0])
        : undefined,
    };
  }

  async suggest(dto: SuggestQueryDto): Promise<SuggestResult[]> {
    const variants = this.getSearchVariants(dto.q);
    if (variants.length === 0) return [];

    const queryRefs = variants.map((_, index) => `$${String(index + 1)}`);
    const similarityExpression = `GREATEST(${queryRefs
      .map((ref) => `similarity(${this.normalizeSqlText('title')}, ${this.normalizeSqlText(ref)})`)
      .join(', ')})`;
    const whereClause = queryRefs
      .map(
        (ref) => `
          similarity(${this.normalizeSqlText('title')}, ${this.normalizeSqlText(ref)}) > 0.08
          OR ${this.normalizeSqlText('title')} LIKE '%' || ${this.normalizeSqlText(ref)} || '%'
        `,
      )
      .map((condition) => `(${condition})`)
      .join(' OR ');

    const results = await this.prisma.$queryRawUnsafe<SuggestResult[]>(
      `
      SELECT
        id,
        title,
        ${similarityExpression} AS similarity
      FROM works
      WHERE (${whereClause})
      AND ("isPublic" = true OR status = 'PUBLISHED')
      ORDER BY similarity DESC
      LIMIT 10
      `,
      ...variants,
    );

    return results;
  }
}
