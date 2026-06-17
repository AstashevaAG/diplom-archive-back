import { Injectable, NotFoundException } from '@nestjs/common';
import { FaqItem } from '@prisma/client';
import { PrismaService } from '../prisma';
import { CreateFaqItemDto, UpdateFaqItemDto } from './dto';

export interface FaqItemWithAuthor extends FaqItem {
  author: { id: string; fullName: string };
}

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: string, dto: CreateFaqItemDto): Promise<FaqItemWithAuthor> {
    return this.prisma.faqItem.create({
      data: {
        question: dto.question,
        answer: dto.answer,
        orderIndex: dto.orderIndex ?? 0,
        isActive: dto.isActive ?? true,
        authorId,
      },
      include: { author: { select: { id: true, fullName: true } } },
    }) as Promise<FaqItemWithAuthor>;
  }

  async findPublished(): Promise<FaqItemWithAuthor[]> {
    return this.prisma.faqItem.findMany({
      where: { isActive: true },
      include: { author: { select: { id: true, fullName: true } } },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    }) as Promise<FaqItemWithAuthor[]>;
  }

  async findAllForAdmin(): Promise<FaqItemWithAuthor[]> {
    return this.prisma.faqItem.findMany({
      include: { author: { select: { id: true, fullName: true } } },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    }) as Promise<FaqItemWithAuthor[]>;
  }

  async update(id: string, dto: UpdateFaqItemDto): Promise<FaqItemWithAuthor> {
    const item = await this.prisma.faqItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Вопрос не найден');

    return this.prisma.faqItem.update({
      where: { id },
      data: dto,
      include: { author: { select: { id: true, fullName: true } } },
    }) as Promise<FaqItemWithAuthor>;
  }

  async delete(id: string): Promise<void> {
    const item = await this.prisma.faqItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Вопрос не найден');
    await this.prisma.faqItem.delete({ where: { id } });
  }
}

