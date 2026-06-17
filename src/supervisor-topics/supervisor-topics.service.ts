import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  SupervisorTopic,
  TopicResponse,
  TopicResponseMessage,
  TopicResponseStatus,
  WorkStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateSupervisorTopicDto,
  UpdateSupervisorTopicDto,
  RespondToTopicDto,
} from './dto';

export interface TopicResponseMessageWithAuthor extends TopicResponseMessage {
  author: { id: string; fullName: string; avatarUrl: string | null };
}

@Injectable()
export class SupervisorTopicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    supervisorId: string,
    dto: CreateSupervisorTopicDto,
  ): Promise<SupervisorTopic> {
    return this.prisma.supervisorTopic.create({
      data: {
        title: dto.title,
        description: dto.description,
        area: dto.area,
        supervisorId,
      },
      include: {
        supervisor: { select: { id: true, fullName: true, specialization: true } },
        _count: { select: { responses: true } },
      },
    });
  }

  async findAll(supervisorId?: string, area?: string): Promise<SupervisorTopic[]> {
    return this.prisma.supervisorTopic.findMany({
      where: {
        isActive: true,
        ...(supervisorId ? { supervisorId } : {}),
        ...(area ? { area } : {}),
      },
      include: {
        supervisor: { select: { id: true, fullName: true, specialization: true, avatarUrl: true } },
        _count: { select: { responses: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMy(supervisorId: string): Promise<SupervisorTopic[]> {
    return this.prisma.supervisorTopic.findMany({
      where: { supervisorId },
      include: {
        responses: {
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                email: true,
                group: true,
                avatarUrl: true,
              },
            },
            messages: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              include: {
                author: { select: { id: true, fullName: true, avatarUrl: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { responses: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    topicId: string,
    supervisorId: string,
    dto: UpdateSupervisorTopicDto,
  ): Promise<SupervisorTopic> {
    const topic = await this.prisma.supervisorTopic.findUnique({
      where: { id: topicId },
    });
    if (!topic) throw new NotFoundException('Тема не найдена');
    if (topic.supervisorId !== supervisorId)
      throw new ForbiddenException('Нет прав для редактирования');

    return this.prisma.supervisorTopic.update({
      where: { id: topicId },
      data: dto,
    });
  }

  async delete(topicId: string, supervisorId: string): Promise<void> {
    const topic = await this.prisma.supervisorTopic.findUnique({
      where: { id: topicId },
    });
    if (!topic) throw new NotFoundException('Тема не найдена');
    if (topic.supervisorId !== supervisorId)
      throw new ForbiddenException('Нет прав для удаления');

    await this.prisma.supervisorTopic.delete({ where: { id: topicId } });
  }

  async respond(
    topicId: string,
    studentId: string,
    dto: RespondToTopicDto,
  ): Promise<TopicResponse> {
    const topic = await this.prisma.supervisorTopic.findUnique({
      where: { id: topicId },
      include: { supervisor: { select: { fullName: true } } },
    });
    if (!topic) throw new NotFoundException('Тема не найдена');
    if (!topic.isActive) throw new BadRequestException('Тема закрыта для откликов');

    const existing = await this.prisma.topicResponse.findUnique({
      where: { studentId_topicId: { studentId, topicId } },
    });
    if (existing) throw new BadRequestException('Вы уже откликнулись на эту тему');

    const student = await this.prisma.user.findUnique({ where: { id: studentId } });

    const response = await this.prisma.topicResponse.create({
      data: {
        message: dto.message,
        studentId,
        topicId,
      },
      include: {
        student: { select: { id: true, fullName: true, email: true, group: true } },
        topic: { select: { id: true, title: true } },
      },
    });

    if (dto.message?.trim()) {
      await this.prisma.topicResponseMessage.create({
        data: {
          text: dto.message.trim(),
          authorId: studentId,
          responseId: response.id,
        },
      });
    }

    await this.notifications.create({
      userId: topic.supervisorId,
      type: 'TOPIC_RESPONSE_NEW',
      title: 'Новый отклик на тему',
      message: `Студент ${student?.fullName ?? 'Неизвестный'} откликнулся на тему: «${topic.title}»`,
      data: { responseId: response.id, topicId, studentId, topicTitle: topic.title },
    });

    return response;
  }

  async getResponses(topicId: string, supervisorId: string): Promise<TopicResponse[]> {
    const topic = await this.prisma.supervisorTopic.findUnique({ where: { id: topicId } });
    if (!topic) throw new NotFoundException('Тема не найдена');
    if (topic.supervisorId !== supervisorId)
      throw new ForbiddenException('Нет прав');

    return this.prisma.topicResponse.findMany({
      where: { topicId },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            email: true,
            group: true,
            avatarUrl: true,
            portfolioItems: {
              select: { id: true, title: true, type: true, year: true, grade: true },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            author: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getResponseMessages(
    topicId: string,
    responseId: string,
    requesterId: string,
  ): Promise<TopicResponseMessageWithAuthor[]> {
    const response = await this.prisma.topicResponse.findUnique({
      where: { id: responseId },
      include: { topic: { select: { supervisorId: true } } },
    });

    if (!response || response.topicId !== topicId) {
      throw new NotFoundException('Отклик не найден');
    }

    if (response.studentId !== requesterId && response.topic.supervisorId !== requesterId) {
      throw new ForbiddenException('Нет доступа к диалогу');
    }

    return this.prisma.topicResponseMessage.findMany({
      where: { responseId },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    }) as Promise<TopicResponseMessageWithAuthor[]>;
  }

  async sendResponseMessage(
    topicId: string,
    responseId: string,
    authorId: string,
    text: string,
  ): Promise<TopicResponseMessageWithAuthor> {
    const response = await this.prisma.topicResponse.findUnique({
      where: { id: responseId },
      include: {
        student: { select: { id: true, fullName: true } },
        topic: {
          select: {
            id: true,
            title: true,
            supervisorId: true,
            supervisor: { select: { fullName: true } },
          },
        },
      },
    });

    if (!response || response.topicId !== topicId) {
      throw new NotFoundException('Отклик не найден');
    }

    if (response.studentId !== authorId && response.topic.supervisorId !== authorId) {
      throw new ForbiddenException('Нет доступа к диалогу');
    }

    if (response.status !== TopicResponseStatus.PENDING) {
      throw new BadRequestException(
        'Диалог по отклику уже закрыт. Продолжите общение в рабочем пространстве.',
      );
    }

    const cleanText = text.trim();
    if (!cleanText) throw new BadRequestException('Сообщение не может быть пустым');

    const message = await this.prisma.topicResponseMessage.create({
      data: { text: cleanText, authorId, responseId },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    const recipientId =
      authorId === response.studentId ? response.topic.supervisorId : response.studentId;

    await this.notifications.create({
      userId: recipientId,
      type: 'TOPIC_RESPONSE_MESSAGE',
      title: 'Новое сообщение по отклику',
      message:
        authorId === response.studentId
          ? `Студент ${response.student.fullName} написал по теме «${response.topic.title}»`
          : `Преподаватель ${response.topic.supervisor.fullName} написал по вашему отклику на тему «${response.topic.title}»`,
      data: { topicId, responseId },
    });

    return message as TopicResponseMessageWithAuthor;
  }

  async acceptResponse(
    topicId: string,
    responseId: string,
    supervisorId: string,
  ): Promise<TopicResponse> {
    const topic = await this.prisma.supervisorTopic.findUnique({ where: { id: topicId } });
    if (!topic) throw new NotFoundException('Тема не найдена');
    if (topic.supervisorId !== supervisorId)
      throw new ForbiddenException('Нет прав');

    const response = await this.prisma.topicResponse.findUnique({
      where: { id: responseId },
      include: { student: { select: { id: true, fullName: true } } },
    });
    if (!response || response.topicId !== topicId)
      throw new NotFoundException('Отклик не найден');
    if (response.status !== TopicResponseStatus.PENDING)
      throw new BadRequestException('Отклик уже обработан');

    const otherPendingResponses = await this.prisma.topicResponse.findMany({
      where: {
        topicId,
        id: { not: responseId },
        status: TopicResponseStatus.PENDING,
      },
      select: { id: true, studentId: true },
    });

    const stages = [
      'Тема выбрана',
      'Тема утверждена',
      'Работа в процессе написания',
      'Финальная проверка',
      'Требуются доработки',
      'Допущена к защите',
      'Работа завершена',
    ];

    const storedResponseMessages = await this.prisma.topicResponseMessage.findMany({
      where: { responseId },
      orderBy: { createdAt: 'asc' },
    });
    const responseMessages =
      storedResponseMessages.length > 0 || !response.message?.trim()
        ? storedResponseMessages
        : [{
            text: response.message.trim(),
            authorId: response.studentId,
            createdAt: response.createdAt,
          }];

    const { updated, work } = await this.prisma.$transaction(async (tx) => {
      const updatedResponse = await tx.topicResponse.update({
        where: { id: responseId },
        data: { status: TopicResponseStatus.ACCEPTED },
      });

      await tx.topicResponse.updateMany({
        where: {
          topicId,
          id: { not: responseId },
          status: TopicResponseStatus.PENDING,
        },
        data: { status: TopicResponseStatus.REJECTED },
      });

      await tx.supervisorTopic.update({
        where: { id: topicId },
        data: { isActive: false },
      });

      const createdWork = await tx.work.create({
        data: {
          title: topic.title,
          annotation: topic.description,
          status: WorkStatus.TOPIC_SELECTED,
          isPublic: false,
          authorId: response.studentId,
          supervisorId: topic.supervisorId,
          topicResponseId: responseId,
        },
      });

      await tx.workStage.createMany({
        data: stages.map((name, idx) => ({
          name,
          workId: createdWork.id,
          isCompleted: idx === 0,
          completedAt: idx === 0 ? new Date() : null,
        })),
      });

      if (responseMessages.length > 0) {
        await tx.workMessage.createMany({
          data: responseMessages.map((message) => ({
            text: message.text,
            authorId: message.authorId,
            workId: createdWork.id,
            createdAt: message.createdAt,
          })),
        });
      }

      return { updated: updatedResponse, work: createdWork };
    });

    await this.notifications.create({
      userId: response.studentId,
      type: 'TOPIC_RESPONSE_ACCEPTED',
      title: 'Ваш отклик принят!',
      message: `Преподаватель принял ваш отклик на тему «${topic.title}». Работа создана!`,
      data: { topicId, workId: work.id, responseId },
    });

    await Promise.all(
      otherPendingResponses.map((pendingResponse) =>
        this.notifications.create({
          userId: pendingResponse.studentId,
          type: 'TOPIC_RESPONSE_REJECTED',
          title: 'Тема уже занята',
          message: `Преподаватель выбрал другого студента на тему «${topic.title}»`,
          data: { topicId, responseId: pendingResponse.id },
        }),
      ),
    );

    return updated;
  }

  async rejectResponse(
    topicId: string,
    responseId: string,
    supervisorId: string,
  ): Promise<TopicResponse> {
    const topic = await this.prisma.supervisorTopic.findUnique({ where: { id: topicId } });
    if (!topic) throw new NotFoundException('Тема не найдена');
    if (topic.supervisorId !== supervisorId)
      throw new ForbiddenException('Нет прав');

    const response = await this.prisma.topicResponse.findUnique({
      where: { id: responseId },
    });
    if (!response || response.topicId !== topicId)
      throw new NotFoundException('Отклик не найден');
    if (response.status !== TopicResponseStatus.PENDING)
      throw new BadRequestException('Отклик уже обработан');

    const updated = await this.prisma.topicResponse.update({
      where: { id: responseId },
      data: { status: TopicResponseStatus.REJECTED },
    });

    await this.notifications.create({
      userId: response.studentId,
      type: 'TOPIC_RESPONSE_REJECTED',
      title: 'Отклик на тему отклонён',
      message: `Преподаватель отклонил ваш отклик на тему «${topic.title}»`,
      data: { topicId, responseId },
    });

    return updated;
  }

  async getMyResponses(studentId: string): Promise<TopicResponse[]> {
    return this.prisma.topicResponse.findMany({
      where: {
        studentId,
        OR: [
          {
            status: TopicResponseStatus.PENDING,
            topic: { isActive: true },
          },
          {
            status: TopicResponseStatus.ACCEPTED,
            work: { isNot: null },
          },
        ],
      },
      include: {
        topic: {
          include: {
            supervisor: { select: { id: true, fullName: true, specialization: true } },
          },
        },
        work: { select: { id: true, title: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            author: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
