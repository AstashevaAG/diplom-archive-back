import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Role, User, WorkStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma';
import { CreateWorkDto, UpdateWorkDto, UpdateWorkStatusDto, WorkQueryDto } from './dto';
import { PaginatedResult, WorkWithRelations } from './interfaces';

const workInclude = {
  author: { select: { id: true, fullName: true, email: true } },
  supervisor: { select: { id: true, fullName: true, email: true } },
  files: { select: { id: true, type: true, originalName: true, url: true } },
  _count: { select: { reviews: true, comments: true } },
} satisfies Prisma.WorkInclude;

@Injectable()
export class WorksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWorkDto, authorId: string): Promise<WorkWithRelations> {
    const work = await this.prisma.work.create({
      data: {
        title: dto.title,
        annotation: dto.annotation,
        category: dto.category,
        tags: dto.tags ?? [],
        year: dto.year,
        authorId,
        supervisorId: dto.supervisorId,
      },
      include: workInclude,
    });

    // Create default stages
    const stages = [
      'Выбор темы',
      'Утверждение',
      'Черновик',
      'Рецензия',
      'Защита',
      'Публикация',
    ];

    await this.prisma.workStage.createMany({
      data: stages.map((name) => ({ name, workId: work.id })),
    });

    return work as WorkWithRelations;
  }

  async findAll(
    query: WorkQueryDto,
  ): Promise<PaginatedResult<WorkWithRelations>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.WorkWhereInput = {};
    if (query.category) where.category = query.category;
    if (query.year) where.year = query.year;
    if (query.supervisorId) where.supervisorId = query.supervisorId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.work.findMany({
        where,
        include: workInclude,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.work.count({ where }),
    ]);

    return {
      data: data as WorkWithRelations[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findPublic(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<WorkWithRelations>> {
    const skip = (page - 1) * limit;

    const where: Prisma.WorkWhereInput = {
      isPublic: true,
      status: WorkStatus.PUBLISHED,
    };

    const [data, total] = await Promise.all([
      this.prisma.work.findMany({
        where,
        include: workInclude,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.work.count({ where }),
    ]);

    return {
      data: data as WorkWithRelations[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<WorkWithRelations> {
    const work = await this.prisma.work.findUnique({
      where: { id },
      include: workInclude,
    });

    if (!work) {
      throw new NotFoundException('Работа не найдена');
    }

    // Increment view count
    await this.prisma.work.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    return work as WorkWithRelations;
  }

  async findByAuthor(authorId: string): Promise<WorkWithRelations[]> {
    const works = await this.prisma.work.findMany({
      where: { authorId },
      include: workInclude,
      orderBy: { createdAt: 'desc' },
    });
    return works as WorkWithRelations[];
  }

  async findBySupervisor(supervisorId: string): Promise<WorkWithRelations[]> {
    const works = await this.prisma.work.findMany({
      where: { supervisorId },
      include: workInclude,
      orderBy: { createdAt: 'desc' },
    });
    return works as WorkWithRelations[];
  }

  async update(
    id: string,
    dto: UpdateWorkDto,
    user: User,
  ): Promise<WorkWithRelations> {
    const work = await this.prisma.work.findUnique({ where: { id } });
    if (!work) {
      throw new NotFoundException('Работа не найдена');
    }

    if (work.authorId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Нет прав для редактирования');
    }

    const updated = await this.prisma.work.update({
      where: { id },
      data: dto,
      include: workInclude,
    });

    return updated as WorkWithRelations;
  }

  async updateStatus(
    id: string,
    dto: UpdateWorkStatusDto,
    user: User,
  ): Promise<WorkWithRelations> {
    const work = await this.prisma.work.findUnique({ where: { id } });
    if (!work) {
      throw new NotFoundException('Работа не найдена');
    }

    if (
      work.supervisorId !== user.id &&
      work.authorId !== user.id &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException('Нет прав для изменения статуса');
    }

    const updated = await this.prisma.work.update({
      where: { id },
      data: { status: dto.status },
      include: workInclude,
    });

    return updated as WorkWithRelations;
  }

  async delete(id: string, user: User): Promise<void> {
    const work = await this.prisma.work.findUnique({ where: { id } });
    if (!work) {
      throw new NotFoundException('Работа не найдена');
    }

    if (work.authorId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Нет прав для удаления');
    }

    await this.prisma.work.delete({ where: { id } });
  }
}
