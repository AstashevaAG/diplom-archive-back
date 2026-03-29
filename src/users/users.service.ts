import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Role, User, StudentPortfolioItem } from '@prisma/client';
import { PrismaService } from '../prisma';
import { UpdateUserDto } from './dto';
import { SafeUser, toSafeUser } from './interfaces';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    return toSafeUser(user);
  }

  async findAll(role?: Role): Promise<SafeUser[]> {
    const users = await this.prisma.user.findMany({
      where: role ? { role } : undefined,
      orderBy: { fullName: 'asc' },
    });
    return users.map(toSafeUser);
  }

  async findSupervisors(): Promise<SafeUser[]> {
    const users = await this.prisma.user.findMany({
      where: { role: Role.SUPERVISOR, isBlocked: false },
      orderBy: { fullName: 'asc' },
    });
    return users.map(toSafeUser);
  }

  async updateProfile(userId: string, dto: UpdateUserDto): Promise<SafeUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
    return toSafeUser(user);
  }

  async updateRole(
    targetUserId: string,
    newRole: Role,
    adminUser: User,
  ): Promise<SafeUser> {
    if (adminUser.role !== Role.ADMIN) {
      throw new ForbiddenException('Недостаточно прав');
    }

    const user = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
    });
    return toSafeUser(user);
  }

  async blockUser(
    targetUserId: string,
    block: boolean,
    adminUser: User,
  ): Promise<SafeUser> {
    if (adminUser.role !== Role.ADMIN) {
      throw new ForbiddenException('Недостаточно прав');
    }

    const user = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isBlocked: block },
    });
    return toSafeUser(user);
  }

  async getPortfolioByUserId(userId: string): Promise<StudentPortfolioItem[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return this.prisma.studentPortfolioItem.findMany({
      where: { studentId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWorksAsSupervisor(supervisorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: supervisorId } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return this.prisma.work.findMany({
      where: {
        supervisorId,
        status: 'PUBLISHED',
        isPublic: true,
      },
      include: {
        author: { select: { id: true, fullName: true, email: true } },
        supervisor: { select: { id: true, fullName: true, email: true } },
        _count: { select: { reviews: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
