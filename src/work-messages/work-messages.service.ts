import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { WorkMessage } from '@prisma/client';
import { PrismaService } from '../prisma';

export interface WorkMessageWithAuthor extends WorkMessage {
  author: { id: string; fullName: string; avatarUrl: string | null };
}

@Injectable()
export class WorkMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async sendMessage(
    workId: string,
    authorId: string,
    text: string,
  ): Promise<WorkMessageWithAuthor> {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFoundException('Работа не найдена');

    if (work.authorId !== authorId && work.supervisorId !== authorId) {
      throw new ForbiddenException('Нет доступа к этой работе');
    }

    return this.prisma.workMessage.create({
      data: { text, authorId, workId },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    }) as Promise<WorkMessageWithAuthor>;
  }

  async getMessages(
    workId: string,
    requesterId: string,
  ): Promise<WorkMessageWithAuthor[]> {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFoundException('Работа не найдена');

    if (work.authorId !== requesterId && work.supervisorId !== requesterId) {
      throw new ForbiddenException('Нет доступа к сообщениям');
    }

    return this.prisma.workMessage.findMany({
      where: { workId },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    }) as Promise<WorkMessageWithAuthor[]>;
  }
}
