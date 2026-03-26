import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { TopicRequest, TopicRequestStatus, User, Role } from '@prisma/client';
import { PrismaService } from '../prisma';
import { CreateTopicRequestDto } from './dto';

@Injectable()
export class TopicRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateTopicRequestDto,
    studentId: string,
  ): Promise<TopicRequest> {
    return this.prisma.topicRequest.create({
      data: {
        proposedTopic: dto.proposedTopic,
        justification: dto.justification,
        supervisorId: dto.supervisorId,
        studentId,
      },
    });
  }

  async findByStudent(studentId: string): Promise<TopicRequest[]> {
    return this.prisma.topicRequest.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySupervisor(supervisorId: string): Promise<TopicRequest[]> {
    return this.prisma.topicRequest.findMany({
      where: { supervisorId },
      include: {
        student: { select: { id: true, fullName: true, email: true, group: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(
    requestId: string,
    status: TopicRequestStatus,
    user: User,
  ): Promise<TopicRequest> {
    const request = await this.prisma.topicRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Заявка не найдена');
    }

    if (request.supervisorId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Нет прав для обработки заявки');
    }

    return this.prisma.topicRequest.update({
      where: { id: requestId },
      data: { status },
    });
  }
}
