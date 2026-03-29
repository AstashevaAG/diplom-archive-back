import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  TopicRequest,
  TopicRequestStatus,
  User,
  Role,
  WorkStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTopicRequestDto } from './dto';

@Injectable()
export class TopicRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    dto: CreateTopicRequestDto,
    studentId: string,
  ): Promise<TopicRequest> {
    const supervisor = await this.prisma.user.findUnique({
      where: { id: dto.supervisorId },
    });

    if (!supervisor || supervisor.role !== Role.SUPERVISOR) {
      throw new BadRequestException('Указанный руководитель не найден');
    }

    const existing = await this.prisma.topicRequest.findFirst({
      where: {
        studentId,
        supervisorId: dto.supervisorId,
        status: TopicRequestStatus.PENDING,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'У вас уже есть ожидающая заявка к этому руководителю',
      );
    }

    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
    });

    const request = await this.prisma.topicRequest.create({
      data: {
        proposedTopic: dto.proposedTopic,
        justification: dto.justification,
        supervisorId: dto.supervisorId,
        studentId,
      },
      include: {
        student: {
          select: { id: true, fullName: true, email: true, group: true },
        },
        supervisor: { select: { id: true, fullName: true } },
      },
    });

    await this.notifications.create({
      userId: dto.supervisorId,
      type: 'TOPIC_REQUEST_NEW',
      title: 'Новая заявка на тему',
      message: `Студент ${student?.fullName ?? 'Неизвестный'} предлагает тему: «${dto.proposedTopic}»`,
      data: {
        requestId: request.id,
        studentId,
        studentName: student?.fullName ?? '',
      },
    });

    return request;
  }

  async findByStudent(studentId: string): Promise<TopicRequest[]> {
    return this.prisma.topicRequest.findMany({
      where: { studentId },
      include: {
        supervisor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            specialization: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySupervisor(supervisorId: string): Promise<TopicRequest[]> {
    return this.prisma.topicRequest.findMany({
      where: { supervisorId },
      include: {
        student: {
          select: { id: true, fullName: true, email: true, group: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(requestId: string, user: User): Promise<TopicRequest> {
    const request = await this.prisma.topicRequest.findUnique({
      where: { id: requestId },
      include: {
        student: { select: { id: true, fullName: true } },
        supervisor: { select: { id: true, fullName: true } },
      },
    });

    if (!request) {
      throw new NotFoundException('Заявка не найдена');
    }

    if (request.supervisorId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Нет прав для обработки заявки');
    }

    if (request.status !== TopicRequestStatus.PENDING) {
      throw new BadRequestException('Заявка уже обработана');
    }

    const updatedRequest = await this.prisma.topicRequest.update({
      where: { id: requestId },
      data: { status: TopicRequestStatus.APPROVED },
      include: {
        student: { select: { id: true, fullName: true } },
        supervisor: { select: { id: true, fullName: true } },
      },
    });

    const stages = [
      'Выбор темы',
      'Утверждение темы',
      'Сбор материала и написание чернового варианта',
      'Рецензирование руководителем',
      'Подготовка к защите',
      'Защита',
    ];

    const work = await this.prisma.work.create({
      data: {
        title: request.proposedTopic,
        status: WorkStatus.TOPIC_SELECTED,
        isPublic: false,
        authorId: request.studentId,
        supervisorId: request.supervisorId,
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
      userId: request.studentId,
      type: 'TOPIC_REQUEST_APPROVED',
      title: 'Заявка на тему одобрена',
      message: `Руководитель ${request.supervisor.fullName} утвердил вашу тему: «${request.proposedTopic}». Работа создана и готова к выполнению.`,
      data: {
        requestId,
        workId: work.id,
        supervisorName: request.supervisor.fullName,
      },
    });

    return updatedRequest;
  }

  async reject(
    requestId: string,
    user: User,
    rejectReason?: string,
  ): Promise<TopicRequest> {
    const request = await this.prisma.topicRequest.findUnique({
      where: { id: requestId },
      include: {
        supervisor: { select: { id: true, fullName: true } },
      },
    });

    if (!request) {
      throw new NotFoundException('Заявка не найдена');
    }

    if (request.supervisorId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Нет прав для обработки заявки');
    }

    if (request.status !== TopicRequestStatus.PENDING) {
      throw new BadRequestException('Заявка уже обработана');
    }

    const updatedRequest = await this.prisma.topicRequest.update({
      where: { id: requestId },
      data: {
        status: TopicRequestStatus.REJECTED,
        rejectReason: rejectReason ?? null,
      },
    });

    const reasonText = rejectReason ? ` Причина: ${rejectReason}` : '';
    await this.notifications.create({
      userId: request.studentId,
      type: 'TOPIC_REQUEST_REJECTED',
      title: 'Заявка на тему отклонена',
      message: `Руководитель ${request.supervisor.fullName} отклонил вашу тему: «${request.proposedTopic}».${reasonText}`,
      data: {
        requestId,
        supervisorName: request.supervisor.fullName,
        rejectReason: rejectReason ?? '',
      },
    });

    return updatedRequest;
  }
}
