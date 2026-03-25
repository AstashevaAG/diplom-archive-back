import { Injectable, NotFoundException } from '@nestjs/common';
import { Comment } from '@prisma/client';
import { PrismaService } from '../prisma';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workId: string, authorId: string, text: string): Promise<Comment> {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) {
      throw new NotFoundException('Работа не найдена');
    }

    return this.prisma.comment.create({
      data: { text, authorId, workId },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
  }

  async findByWork(workId: string): Promise<Comment[]> {
    return this.prisma.comment.findMany({
      where: { workId },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async delete(commentId: string, userId: string): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Комментарий не найден');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (comment.authorId !== userId && user?.role !== 'ADMIN') {
      throw new NotFoundException('Нет прав для удаления');
    }

    await this.prisma.comment.delete({ where: { id: commentId } });
  }
}
