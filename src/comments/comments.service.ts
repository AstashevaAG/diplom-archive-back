import { Injectable, NotFoundException } from '@nestjs/common';
import { Comment } from '@prisma/client';
import { PrismaService } from '../prisma';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(workId: string, authorId: string, text: string): Promise<Comment> {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: {
        id: true,
        title: true,
        authorId: true,
        supervisorId: true,
      },
    });
    if (!work) {
      throw new NotFoundException('Работа не найдена');
    }

    const comment = await this.prisma.comment.create({
      data: { text, authorId, workId },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { fullName: true },
    });
    const recipients = new Set<string>();
    if (work.authorId !== authorId) recipients.add(work.authorId);
    if (work.supervisorId && work.supervisorId !== authorId) {
      recipients.add(work.supervisorId);
    }

    await Promise.all(
      [...recipients].map((userId) =>
        this.notifications.create({
          userId,
          type: 'WORK_COMMENT_NEW',
          title: 'Новый комментарий к ВКР',
          message: `${author?.fullName ?? 'Пользователь'} оставил(а) комментарий к работе «${work.title}».`,
          data: {
            workId: work.id,
            commentId: comment.id,
            authorId,
          },
        }),
      ),
    );

    return comment;
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
