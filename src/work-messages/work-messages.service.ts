import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { WorkMessage } from '@prisma/client';
import { PrismaService } from '../prisma';
import { NotificationsService } from '../notifications/notifications.service';
import { normalizeFileNameEncoding } from '../files/file-name.utils';

export interface WorkMessageWithAuthor extends WorkMessage {
  author: { id: string; fullName: string; avatarUrl: string | null };
  file: {
    id: string;
    type: string;
    originalName: string;
    url: string;
    size: number;
    version: number;
    comment: string | null;
    createdAt: Date;
  } | null;
}

@Injectable()
export class WorkMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async sendMessage(
    workId: string,
    authorId: string,
    text: string,
    fileId?: string,
  ): Promise<WorkMessageWithAuthor> {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: {
        id: true,
        title: true,
        authorId: true,
        supervisorId: true,
      },
    });
    if (!work) throw new NotFoundException('Работа не найдена');

    if (work.authorId !== authorId && work.supervisorId !== authorId) {
      throw new ForbiddenException('Нет доступа к этой работе');
    }

    let attachedFileId: string | undefined;
    if (fileId) {
      const file = await this.prisma.file.findUnique({
        where: { id: fileId },
        select: { id: true, workId: true },
      });
      if (!file || file.workId !== workId) {
        throw new ForbiddenException('Файл не относится к этой работе');
      }
      attachedFileId = file.id;
    }

    const message = (await this.prisma.workMessage.create({
      data: { text, authorId, workId, fileId: attachedFileId },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
        file: {
          select: {
            id: true,
            type: true,
            originalName: true,
            url: true,
            size: true,
            version: true,
            comment: true,
            createdAt: true,
          },
        },
      },
    })) as WorkMessageWithAuthor;

    const normalizedMessage = this.normalizeMessageFileName(message);

    const recipientId =
      authorId === work.authorId ? work.supervisorId : work.authorId;
    if (recipientId) {
      await this.notifications.create({
        userId: recipientId,
        type: 'WORK_MESSAGE_NEW',
        title: 'Новое сообщение по ВКР',
        message: `${message.author.fullName} написал(а) в рабочем пространстве «${work.title}».`,
        data: {
          workId: work.id,
          messageId: message.id,
          authorId,
        },
      });
    }

    return normalizedMessage;
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

    const messages = (await this.prisma.workMessage.findMany({
      where: { workId },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
        file: {
          select: {
            id: true,
            type: true,
            originalName: true,
            url: true,
            size: true,
            version: true,
            comment: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })) as WorkMessageWithAuthor[];

    return messages.map((message) => this.normalizeMessageFileName(message));
  }

  private normalizeMessageFileName(
    message: WorkMessageWithAuthor,
  ): WorkMessageWithAuthor {
    if (!message.file) return message;

    return {
      ...message,
      file: {
        ...message.file,
        originalName: normalizeFileNameEncoding(message.file.originalName),
      },
    };
  }
}
