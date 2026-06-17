import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let jwtService: { signAsync: jest.Mock; verify: jest.Mock };

  const baseUser = {
    id: 'user-1',
    email: 'student@example.com',
    passwordHash: 'stored-hash',
    fullName: 'Мария Иванова',
    role: Role.STUDENT,
    group: '221-322',
    specialization: null,
    isApproved: true,
    isBlocked: false,
    blockedUntil: null,
    failedLogins: 0,
    refreshToken: null,
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    jwtService = {
      signAsync: jest
        .fn()
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token'),
      verify: jest.fn(),
    };
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-value');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      { get: jest.fn((_key: string, fallback?: string) => fallback ?? 'secret') } as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('отправляет регистрацию студента на модерацию без выдачи токенов', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ ...baseUser, isApproved: false });

    const result = await service.register({
      email: baseUser.email,
      password: 'password123',
      fullName: baseUser.fullName,
      role: Role.STUDENT,
      group: baseUser.group,
    });

    expect(result).toEqual({
      requiresApproval: true,
      message: expect.stringContaining('Заявка на регистрацию отправлена'),
    });
    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    expect(jwtService.signAsync).not.toHaveBeenCalled();
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: baseUser.email,
        passwordHash: 'hashed-value',
        isApproved: false,
      }),
    });
  });

  it('не регистрирует пользователя с занятым email', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser);

    await expect(service.register({
      email: baseUser.email,
      password: 'password123',
      fullName: baseUser.fullName,
      role: Role.STUDENT,
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('успешно авторизует подтверждённого пользователя, сбрасывает счётчик ошибок и сохраняет refresh token', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser);

    const result = await service.login({ email: baseUser.email, password: 'password123' });

    expect(result).toEqual({
      user: {
        id: baseUser.id,
        email: baseUser.email,
        fullName: baseUser.fullName,
        role: baseUser.role,
      },
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
    });
    expect(prisma.user.update).toHaveBeenNthCalledWith(1, {
      where: { id: baseUser.id },
      data: { failedLogins: 0, blockedUntil: null },
    });
    expect(prisma.user.update).toHaveBeenNthCalledWith(2, {
      where: { id: baseUser.id },
      data: { refreshToken: 'hashed-value' },
    });
  });

  it('после пятой неверной попытки временно блокирует вход', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, failedLogins: 4 });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.login({ email: baseUser.email, password: 'wrong-password' }))
      .rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: {
        failedLogins: 0,
        blockedUntil: expect.any(Date),
      },
    });
  });

  it('запрещает вход для неподтверждённого аккаунта', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, isApproved: false });

    await expect(service.login({ email: baseUser.email, password: 'password123' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});
