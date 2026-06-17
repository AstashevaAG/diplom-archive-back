import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role, TopicRequestStatus, WorkStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma';
import { TopicRequestsService } from './topic-requests.service';

describe('TopicRequestsService', () => {
  let service: TopicRequestsService;
  let prisma: {
    user: { findUnique: jest.Mock };
    topicRequest: {
      findFirst: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    work: { create: jest.Mock };
    workStage: { createMany: jest.Mock };
  };
  let notifications: { create: jest.Mock };

  const student = user('student-1', Role.STUDENT, 'Мария Иванова');
  const supervisor = user('supervisor-1', Role.SUPERVISOR, 'Анна Петрова');
  const request = {
    id: 'request-1',
    proposedTopic: 'Психология учебной мотивации',
    justification: 'Есть исследовательский интерес',
    status: TopicRequestStatus.PENDING,
    studentId: student.id,
    supervisorId: supervisor.id,
    student,
    supervisor,
  };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      topicRequest: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      work: { create: jest.fn() },
      workStage: { createMany: jest.fn() },
    };
    notifications = { create: jest.fn() };
    service = new TopicRequestsService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
  });

  it('создаёт заявку руководителю и отправляет уведомление', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(supervisor)
      .mockResolvedValueOnce(student);
    prisma.topicRequest.findFirst.mockResolvedValue(null);
    prisma.topicRequest.create.mockResolvedValue(request);

    const result = await service.create({
      proposedTopic: request.proposedTopic,
      justification: request.justification,
      supervisorId: supervisor.id,
    }, student.id);

    expect(result).toBe(request);
    expect(prisma.topicRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        proposedTopic: request.proposedTopic,
        justification: request.justification,
        supervisorId: supervisor.id,
        studentId: student.id,
      },
    }));
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: supervisor.id,
      type: 'TOPIC_REQUEST_NEW',
      title: 'Новая заявка на тему',
    }));
  });

  it('не создаёт заявку к пользователю без роли руководителя', async () => {
    prisma.user.findUnique.mockResolvedValue(student);

    await expect(service.create({
      proposedTopic: request.proposedTopic,
      supervisorId: student.id,
    }, student.id)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('не создаёт повторную ожидающую заявку к тому же руководителю', async () => {
    prisma.user.findUnique.mockResolvedValue(supervisor);
    prisma.topicRequest.findFirst.mockResolvedValue(request);

    await expect(service.create({
      proposedTopic: request.proposedTopic,
      supervisorId: supervisor.id,
    }, student.id)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('одобряет заявку, создаёт работу и этапы', async () => {
    prisma.topicRequest.findUnique.mockResolvedValue(request);
    prisma.topicRequest.update.mockResolvedValue({ ...request, status: TopicRequestStatus.APPROVED });
    prisma.work.create.mockResolvedValue({ id: 'work-1' });

    const result = await service.approve(request.id, supervisor);

    expect(result.status).toBe(TopicRequestStatus.APPROVED);
    expect(prisma.work.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: request.proposedTopic,
        status: WorkStatus.TOPIC_SELECTED,
        isPublic: false,
        authorId: student.id,
        supervisorId: supervisor.id,
      }),
    });
    expect(prisma.workStage.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ name: 'Тема выбрана', workId: 'work-1', isCompleted: true }),
        expect.objectContaining({ name: 'Работа завершена', workId: 'work-1', isCompleted: false }),
      ]),
    });
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: student.id,
      type: 'TOPIC_REQUEST_APPROVED',
    }));
  });

  it('запрещает чужому руководителю обрабатывать заявку', async () => {
    prisma.topicRequest.findUnique.mockResolvedValue(request);

    await expect(service.approve(request.id, user('other-supervisor', Role.SUPERVISOR, 'Другой руководитель')))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('отклоняет заявку с причиной и уведомляет студента', async () => {
    prisma.topicRequest.findUnique.mockResolvedValue(request);
    prisma.topicRequest.update.mockResolvedValue({ ...request, status: TopicRequestStatus.REJECTED, rejectReason: 'Тема занята' });

    await service.reject(request.id, supervisor, 'Тема занята');

    expect(prisma.topicRequest.update).toHaveBeenCalledWith({
      where: { id: request.id },
      data: { status: TopicRequestStatus.REJECTED, rejectReason: 'Тема занята' },
    });
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: student.id,
      type: 'TOPIC_REQUEST_REJECTED',
      message: expect.stringContaining('Причина: Тема занята'),
    }));
  });
});

function user(id: string, role: Role, fullName: string) {
  return {
    id,
    role,
    fullName,
    email: `${id}@example.com`,
    passwordHash: 'hash',
    group: role === Role.STUDENT ? '221-322' : null,
    specialization: role === Role.SUPERVISOR ? 'Клиническая психология' : null,
    bio: null,
    avatarUrl: null,
    isApproved: true,
    isBlocked: false,
    failedLogins: 0,
    blockedUntil: null,
    refreshToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
