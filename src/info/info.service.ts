import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InfoPost, Role } from '@prisma/client';
import { PrismaService } from '../prisma';
import { CreateInfoPostDto, UpdateInfoPostDto } from './dto';

export interface InfoPostWithAuthor extends InfoPost {
  author: { id: string; fullName: string };
}

@Injectable()
export class InfoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: string, dto: CreateInfoPostDto): Promise<InfoPostWithAuthor> {
    return this.prisma.infoPost.create({
      data: {
        title: dto.title,
        content: dto.content,
        isPinned: dto.isPinned ?? false,
        tags: dto.tags ?? [],
        authorId,
      },
      include: { author: { select: { id: true, fullName: true } } },
    }) as Promise<InfoPostWithAuthor>;
  }

  async findAll(q?: string): Promise<InfoPostWithAuthor[]> {
    const posts = await this.prisma.infoPost.findMany({
      include: { author: { select: { id: true, fullName: true } } },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });

    if (q) {
      const lower = q.toLowerCase();
      return (posts as InfoPostWithAuthor[]).filter(
        (p) =>
          p.title.toLowerCase().includes(lower) ||
          p.content.toLowerCase().includes(lower) ||
          p.tags.some((t) => t.toLowerCase().includes(lower)),
      );
    }

    return posts as InfoPostWithAuthor[];
  }

  async findById(id: string): Promise<InfoPostWithAuthor> {
    const post = await this.prisma.infoPost.findUnique({
      where: { id },
      include: { author: { select: { id: true, fullName: true } } },
    });
    if (!post) throw new NotFoundException('Запись не найдена');
    return post as InfoPostWithAuthor;
  }

  async update(
    id: string,
    userId: string,
    userRole: Role,
    dto: UpdateInfoPostDto,
  ): Promise<InfoPostWithAuthor> {
    const post = await this.prisma.infoPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Запись не найдена');
    if (post.authorId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Нет прав для редактирования');
    }
    return this.prisma.infoPost.update({
      where: { id },
      data: dto,
      include: { author: { select: { id: true, fullName: true } } },
    }) as Promise<InfoPostWithAuthor>;
  }

  async delete(id: string, userId: string, userRole: Role): Promise<void> {
    const post = await this.prisma.infoPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Запись не найдена');
    if (post.authorId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Нет прав для удаления');
    }
    await this.prisma.infoPost.delete({ where: { id } });
  }
}
