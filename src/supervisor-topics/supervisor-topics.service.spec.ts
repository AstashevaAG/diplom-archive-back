import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, TopicResponseStatus, WorkStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma';
import { SupervisorTopicsService } from './supervisor-topics.service';

describe('SupervisorTopicsService', () => {
  let service: SupervisorTopicsService;
  let prisma: any;
  let notifications: { create: jest.Mock };

  const supervisor = user('supervisor-1', Role.SUPERVISOR, 'Анна Петрова');
  const student = user('student-1', Role.STUDENT, 'Мария Иванова');
  const topic = {
    id: 'topic-1',
    title: 'Когнитивные стратегии обучения',
    description: 'Описание темы',
    area: 'Психология образования',
    isActive: true,
    supervisorId: supervisor.id,
    createdAt: new Date(),
  };
  const response = {
    id: 'response-1',
    topicId: topic.id,
    studentId: student.id,
    status: TopicResponseStatus.PENDING,
    message: 'Хочу взять тему',
    createdAt: new Date(),
    student,
  };

  beforeEach(() => {
    prisma = {
      supervisorTopic: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      topicResponse: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      topicResponseMessage: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      work: { create: jest.fn() },
      workStage: { createMany: jest.fn() },
      workMessage: { createMany: jest.fn() },
      $transaction: jest.fn(async (callback: (tx: any) => unknown) => callback(prisma)),
    };
    notifications = { create: jest.fn() };
    service = new SupervisorTopicsService(
      prisma as PrismaService,
      notifications as unknown as NotificationsService,
    );
  });

  it('руководитель создаёт тему с областью и описанием', async () => {
    prisma.supervisorTopic.create.mockResolvedValue(topic);

    await expect(service.create(supervisor.id, {
      title: topic.title,
      area: topic.area,
      description: topic.description,
    })).resolves.toBe(topic);

    expect(prisma.supervisorTopic.create).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        title: topic.title,
        area: topic.area,
        description: topic.description,
        supervisorId: supervisor.id,
      },
    }));
  });

  it('студент откликается на активную тему, создаётся первое сообщение и уведомление', async () => {
    prisma.supervisorTopic.findUnique.mockResolvedValue({ ...topic, supervisor: { fullName: supervisor.fullName } });
    prisma.topicResponse.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(student);
    prisma.topicResponse.create.mockResolvedValue(response);

    await service.respond(topic.id, student.id, { message: ' Хочу взять тему ' });

    expect(prisma.topicResponse.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { message: ' Хочу взять тему ', studentId: student.id, topicId: topic.id },
    }));
    expect(prisma.topicResponseMessage.create).toHaveBeenCalledWith({
      data: { text: 'Хочу взять тему', authorId: student.id, responseId: response.id },
    });
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: supervisor.id,
      type: 'TOPIC_RESPONSE_NEW',
    }));
  });

  it('не даёт откликнуться на закрытую или уже выбранную тему', async () => {
    prisma.supervisorTopic.findUnique.mockResolvedValue({ ...topic, isActive: false });

    await expect(service.respond(topic.id, student.id, {})).rejects.toBeInstanceOf(BadRequestException);

    prisma.supervisorTopic.findUnique.mockResolvedValue(topic);
    prisma.topicResponse.findUnique.mockResolvedValue(response);

    await expect(service.respond(topic.id, student.id, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('защищает диалог отклика от постороннего пользователя и пустых сообщений', async () => {
    prisma.topicResponse.findUnique.mockResolvedValue({
      ...response,
      topic: { supervisorId: supervisor.id, title: topic.title, supervisor: { fullName: supervisor.fullName } },
      student,
    });

    await expect(service.getResponseMessages(topic.id, response.id, 'other-user'))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.sendResponseMessage(topic.id, response.id, student.id, '   '))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('отправляет сообщение в диалог и уведомляет второго участника', async () => {
    const message = { id: 'message-1', text: 'Когда встречаемся?', authorId: supervisor.id };
    prisma.topicResponse.findUnique.mockResolvedValue({
      ...response,
      topic: { supervisorId: supervisor.id, title: topic.title, supervisor: { fullName: supervisor.fullName } },
      student,
    });
    prisma.topicResponseMessage.create.mockResolvedValue(message);

    await expect(service.sendResponseMessage(topic.id, response.id, supervisor.id, ' Когда встречаемся? '))
      .resolves.toBe(message);

    expect(prisma.topicResponseMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { text: 'Когда встречаемся?', authorId: supervisor.id, responseId: response.id },
    }));
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: student.id,
      type: 'TOPIC_RESPONSE_MESSAGE',
    }));
  });

  it('принятие отклика создаёт работу, этапы, переносит сообщения и отклоняет прочие отклики', async () => {
    prisma.supervisorTopic.findUnique.mockResolvedValue(topic);
    prisma.topicResponse.findUnique.mockResolvedValue(response);
    prisma.topicResponse.findMany.mockResolvedValue([{ id: 'response-2', studentId: 'student-2' }]);
    prisma.topicResponseMessage.findMany.mockResolvedValue([{ text: 'История обсуждения', authorId: student.id, createdAt: response.createdAt }]);
    prisma.topicResponse.update.mockResolvedValue({ ...response, status: TopicResponseStatus.ACCEPTED });
    prisma.work.create.mockResolvedValue({ id: 'work-1' });

    const result = await service.acceptResponse(topic.id, response.id, supervisor.id);

    expect(result.status).toBe(TopicResponseStatus.ACCEPTED);
    expect(prisma.work.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: topic.title,
        annotation: topic.description,
        status: WorkStatus.TOPIC_SELECTED,
        authorId: student.id,
        supervisorId: supervisor.id,
        topicResponseId: response.id,
      }),
    });
    expect(prisma.topicResponse.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: TopicResponseStatus.REJECTED },
    }));
    expect(prisma.workMessage.createMany).toHaveBeenCalledWith({
      data: [{ text: 'История обсуждения', authorId: student.id, workId: 'work-1', createdAt: response.createdAt }],
    });
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: student.id,
      type: 'TOPIC_RESPONSE_ACCEPTED',
    }));
  });

  it('отклоняет отклик и уведомляет студента', async () => {
    prisma.supervisorTopic.findUnique.mockResolvedValue(topic);
    prisma.topicResponse.findUnique.mockResolvedValue(response);
    prisma.topicResponse.update.mockResolvedValue({ ...response, status: TopicResponseStatus.REJECTED });

    await service.rejectResponse(topic.id, response.id, supervisor.id);

    expect(prisma.topicResponse.update).toHaveBeenCalledWith({
      where: { id: response.id },
      data: { status: TopicResponseStatus.REJECTED },
    });
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: student.id,
      type: 'TOPIC_RESPONSE_REJECTED',
    }));
  });

  it('возвращает NotFound при попытке редактировать отсутствующую тему', async () => {
    prisma.supervisorTopic.findUnique.mockResolvedValue(null);

    await expect(service.update(topic.id, supervisor.id, { title: 'Новая тема' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('возвращает только актуальные отклики студента', async () => {
    prisma.topicResponse.findMany.mockResolvedValue([response]);

    await service.getMyResponses(student.id);

    expect(prisma.topicResponse.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        studentId: student.id,
        OR: [
          { status: TopicResponseStatus.PENDING, topic: { isActive: true } },
          { status: TopicResponseStatus.ACCEPTED, work: { isNot: null } },
        ],
      },
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
