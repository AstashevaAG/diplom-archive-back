import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  SupervisorTopic,
  TopicResponse,
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
      },
      orderBy: { createdAt: 'desc' },
    });
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

    const updated = await this.prisma.topicResponse.update({
      where: { id: responseId },
      data: { status: TopicResponseStatus.ACCEPTED },
    });

    // Создаем работу со статусом TOPIC_SELECTED, НЕ публичную
    const stages = [
      'Выбор и утверждение темы',
      'Сбор и анализ литературы',
      'Написание черновика',
      'Рецензирование руководителем',
      'Подготовка к защите',
      'Защита дипломной работы',
    ];

    const work = await this.prisma.work.create({
      data: {
        title: topic.title,
        annotation: topic.description,
        status: WorkStatus.TOPIC_SELECTED,
        isPublic: false,
        authorId: response.studentId,
        supervisorId: topic.supervisorId,
      },
    });

    await this.prisma.workStage.createMany({
      data: stages.map((name, idx) => ({
        name,
        workId: work.id,
        isCompleted: idx === 0,
        completedAt: idx === 0 ? new Date() : null,
      })),
    });

    await this.notifications.create({
      userId: response.studentId,
      type: 'TOPIC_RESPONSE_ACCEPTED',
      title: 'Ваш отклик принят!',
      message: `Преподаватель принял ваш отклик на тему «${topic.title}». Работа создана!`,
      data: { topicId, workId: work.id, responseId },
    });

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
      where: { studentId },
      include: {
        topic: {
          include: {
            supervisor: { select: { id: true, fullName: true, specialization: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
