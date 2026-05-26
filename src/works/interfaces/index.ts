import { Work } from '@prisma/client';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type WorkWithRelations = Work & {
  author: { id: string; fullName: string; email: string };
  supervisor: { id: string; fullName: string; email: string } | null;
  files: {
    id: string;
    type: string;
    originalName: string;
    url: string;
    size: number;
    version: number;
    comment: string | null;
    createdAt: Date;
  }[];
  _count: { reviews: number; comments: number };
};
