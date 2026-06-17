import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, WorkStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma';
import { SortBy, StatusFilter } from './dto';
import { WorksService } from './works.service';

describe('WorksService', () => {
  let service: WorksService;
  let prisma: {
    work: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    workStage: {
      createMany: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
    supervisorTopic: {
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let notifications: { create: jest.Mock };

  const student = user({ id: 'student-1', role: Role.STUDENT });
  const supervisor = user({ id: 'supervisor-1', role: Role.SUPERVISOR });
  const work = {
    id: 'work-1',
    title: 'Исследование тревожности',
    authorId: student.id,
    supervisorId: supervisor.id,
    status: WorkStatus.IN_PROGRESS,
    files: [],
  };

  beforeEach(() => {
    prisma = {
      work: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      workStage: {
        createMany: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      supervisorTopic: {
        delete: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (tx: typeof prisma) => unknown) => callback(prisma)),
    };
    notifications = { create: jest.fn() };
    service = new WorksService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
  });

  it('создаёт работу студента и набор базовых этапов', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: supervisor.id, fullName: supervisor.fullName, role: Role.SUPERVISOR })
      .mockResolvedValueOnce({ fullName: student.fullName, group: student.group });
    prisma.work.create.mockResolvedValue(work);

    const result = await service.create({
      title: work.title,
      tags: ['тревожность'],
      supervisorId: supervisor.id,
    }, student.id);

    expect(result).toEqual(work);
    expect(prisma.work.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: work.title,
        tags: ['тревожность'],
        status: WorkStatus.TOPIC_SELECTED,
        authorId: student.id,
        supervisorId: supervisor.id,
      }),
    }));
    expect(prisma.workStage.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ name: 'Тема выбрана', workId: work.id }),
        expect.objectContaining({ name: 'Работа завершена', workId: work.id }),
      ]),
    });
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: supervisor.id,
      type: 'WORK_SUPERVISION_REQUEST',
      data: expect.objectContaining({ workId: work.id, studentId: student.id }),
    }));
  });

  it('по умолчанию отдаёт только опубликованный публичный каталог с пагинацией и сортировкой', async () => {
    prisma.work.findMany.mockResolvedValue([{ ...work, status: WorkStatus.PUBLISHED, isPublic: true }]);
    prisma.work.count.mockResolvedValue(1);

    const result = await service.findAll({
      page: 2,
      limit: 12,
      sortBy: SortBy.SCORE_DESC,
      minScore: 70,
    });

    expect(result.totalPages).toBe(1);
    expect(prisma.work.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        status: WorkStatus.PUBLISHED,
        isPublic: true,
        commissionReviewScore: { gte: 70 },
      },
      skip: 12,
      take: 12,
      orderBy: { commissionReviewScore: 'desc' },
    }));
  });

  it('для фильтра в работе исключает опубликованные и черновики', async () => {
    prisma.work.findMany.mockResolvedValue([work]);
    prisma.work.count.mockResolvedValue(1);

    await service.findAll({ statusFilter: StatusFilter.IN_PROGRESS });

    expect(prisma.work.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { notIn: [WorkStatus.PUBLISHED, WorkStatus.DRAFT] } },
    }));
  });

  it('запрещает редактирование чужой работы', async () => {
    prisma.work.findUnique.mockResolvedValue(work);

    await expect(service.update(work.id, { title: 'Новое название' }, user({ id: 'other-student', role: Role.STUDENT })))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('публикует работу только руководителем и уведомляет автора', async () => {
    prisma.work.findUnique.mockResolvedValue({ ...work, status: WorkStatus.DEFENSE });
    prisma.work.update.mockResolvedValue({ ...work, status: WorkStatus.PUBLISHED, isPublic: true });

    await service.updateStatus(work.id, { status: WorkStatus.PUBLISHED }, supervisor);

    expect(prisma.work.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: work.id },
      data: { status: WorkStatus.PUBLISHED, isPublic: true },
    }));
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: student.id,
      type: 'WORK_PUBLISHED',
      title: 'Работа опубликована',
    }));
  });

  it('возвращает NotFound при изменении отсутствующей работы', async () => {
    prisma.work.findUnique.mockResolvedValue(null);

    await expect(service.update(work.id, { title: 'Нет' }, student))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('разрешает администратору удалять работу в любом статусе', async () => {
    prisma.work.findUnique.mockResolvedValue({ ...work, status: WorkStatus.PUBLISHED, topicResponse: null });

    await service.delete(work.id, user({ id: 'admin-1', role: Role.ADMIN }));

    expect(prisma.work.delete).toHaveBeenCalledWith({ where: { id: work.id } });
  });

  it('при удалении работы удаляет связанную тему с откликом', async () => {
    prisma.work.findUnique.mockResolvedValue({
      ...work,
      topicResponse: { id: 'response-1', topicId: 'topic-1' },
    });

    await service.delete(work.id, student);

    expect(prisma.work.delete).toHaveBeenCalledWith({ where: { id: work.id } });
    expect(prisma.supervisorTopic.delete).toHaveBeenCalledWith({
      where: { id: 'topic-1' },
    });
  });
});

function user(data: { id: string; role: Role }) {
  return {
    id: data.id,
    role: data.role,
    email: `${data.id}@example.com`,
    fullName: data.id,
    passwordHash: 'hash',
    group: null,
    specialization: null,
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
