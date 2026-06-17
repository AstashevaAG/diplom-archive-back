import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    studentPortfolioItem: { findMany: jest.Mock };
    work: { findMany: jest.Mock };
  };

  const admin = user('admin-1', Role.ADMIN);
  const student = user('student-1', Role.STUDENT);
  const supervisor = user('supervisor-1', Role.SUPERVISOR);

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      studentPortfolioItem: { findMany: jest.fn() },
      work: { findMany: jest.fn() },
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('возвращает безопасного пользователя без passwordHash и refreshToken', async () => {
    prisma.user.findUnique.mockResolvedValue(student);

    const result = await service.findById(student.id);

    expect(result).toMatchObject({
      id: student.id,
      email: student.email,
      fullName: student.fullName,
      role: student.role,
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('возвращает NotFound для отсутствующего пользователя', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('фильтрует пользователей по роли и сортирует неподтверждённых первыми', async () => {
    prisma.user.findMany.mockResolvedValue([student]);

    await service.findAll(Role.STUDENT);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { role: Role.STUDENT },
      orderBy: [{ isApproved: 'asc' }, { fullName: 'asc' }],
    });
  });

  it('отдаёт только активных подтверждённых руководителей', async () => {
    prisma.user.findMany.mockResolvedValue([supervisor]);

    await service.findSupervisors();

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { role: Role.SUPERVISOR, isBlocked: false, isApproved: true },
      orderBy: { fullName: 'asc' },
    });
  });

  it('запрещает не-админу менять роль, блокировать и подтверждать пользователей', async () => {
    await expect(service.updateRole(student.id, Role.SUPERVISOR, student))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.blockUser(student.id, true, student))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.approveUser(student.id, student))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('администратор подтверждает и блокирует пользователя', async () => {
    prisma.user.update
      .mockResolvedValueOnce({ ...student, isApproved: true })
      .mockResolvedValueOnce({ ...student, isBlocked: true });

    await service.approveUser(student.id, admin);
    await service.blockUser(student.id, true, admin);

    expect(prisma.user.update).toHaveBeenNthCalledWith(1, {
      where: { id: student.id },
      data: { isApproved: true },
    });
    expect(prisma.user.update).toHaveBeenNthCalledWith(2, {
      where: { id: student.id },
      data: { isBlocked: true },
    });
  });

  it('возвращает портфолио студента и опубликованные работы руководителя', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(student)
      .mockResolvedValueOnce(supervisor);
    prisma.studentPortfolioItem.findMany.mockResolvedValue([{ id: 'portfolio-1', studentId: student.id }]);
    prisma.work.findMany.mockResolvedValue([{ id: 'work-1', supervisorId: supervisor.id }]);

    await expect(service.getPortfolioByUserId(student.id)).resolves.toEqual([{ id: 'portfolio-1', studentId: student.id }]);
    await expect(service.getWorksAsSupervisor(supervisor.id)).resolves.toEqual([{ id: 'work-1', supervisorId: supervisor.id }]);

    expect(prisma.work.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { supervisorId: supervisor.id, status: 'PUBLISHED', isPublic: true },
    }));
  });
});

function user(id: string, role: Role) {
  return {
    id,
    role,
    email: `${id}@example.com`,
    fullName: id,
    passwordHash: 'hash',
    group: role === Role.STUDENT ? '221-322' : null,
    specialization: role === Role.SUPERVISOR ? 'Клиническая психология' : null,
    bio: null,
    avatarUrl: null,
    isApproved: true,
    isBlocked: false,
    failedLogins: 0,
    blockedUntil: null,
    refreshToken: 'refresh-token',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
