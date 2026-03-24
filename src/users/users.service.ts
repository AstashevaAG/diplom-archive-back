import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Role, User } from '@prisma/client';
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
}
