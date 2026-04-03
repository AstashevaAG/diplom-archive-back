export interface SearchResult {
  id: string;
  title: string;
  description: string | null;
  annotation: string | null;
  category: string | null;
  tags: string[];
  year: number | null;
  qualityScore: number | null;
  authorName: string;
  supervisorName: string | null;
  rank: number;
  headline: string | null;
}

export interface SearchResponse {
  data: SearchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  convertedQuery?: string;
}

export interface SuggestResult {
  id: string;
  title: string;
  similarity: number;
}
