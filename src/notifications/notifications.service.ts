import { Injectable, NotFoundException } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { PrismaService } from '../prisma';

export interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: CreateNotificationParams): Promise<Notification> {
    return this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data ?? undefined,
      },
    });
  }

  async findByUser(userId: string): Promise<Notification[]> {
    await this.createDeadlineWarningsForUser(userId);

    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    await this.createDeadlineWarningsForUser(userId);

    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) {
      throw new NotFoundException('Уведомление не найдено');
    }

    return this.prisma.notification.update({
      where: { id: notification.id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  private async createDeadlineWarningsForUser(userId: string): Promise<void> {
    const now = new Date();
    const warningLimit = new Date();
    warningLimit.setDate(warningLimit.getDate() + 3);

    const stages = await this.prisma.workStage.findMany({
      where: {
        isCompleted: false,
        deadline: { lte: warningLimit },
        work: {
          OR: [{ authorId: userId }, { supervisorId: userId }],
        },
      },
      include: {
        work: { select: { id: true, title: true } },
      },
      take: 20,
      orderBy: { deadline: 'asc' },
    });

    for (const stage of stages) {
      if (!stage.deadline) continue;
      const type = `WORK_STAGE_DEADLINE:${stage.id}`;
      const existing = await this.prisma.notification.findFirst({
        where: { userId, type },
        select: { id: true },
      });
      if (existing) continue;

      const isOverdue = stage.deadline.getTime() < now.getTime();
      await this.create({
        userId,
        type,
        title: isOverdue ? 'Этап ВКР просрочен' : 'Приближается дедлайн',
        message: isOverdue
          ? `Этап «${stage.name}» по работе «${stage.work.title}» просрочен.`
          : `Этап «${stage.name}» по работе «${stage.work.title}» нужно завершить до ${stage.deadline.toLocaleDateString('ru-RU')}.`,
        data: {
          workId: stage.work.id,
          stageId: stage.id,
          deadline: stage.deadline.toISOString(),
        },
      });
    }
  }
}
