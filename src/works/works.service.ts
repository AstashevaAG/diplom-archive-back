import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Role, User, WorkStatus, WorkStage, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma';
import {
  CreateWorkDto,
  UpdateWorkDto,
  UpdateWorkStatusDto,
  UpdateStageDto,
  WorkQueryDto,
  SortBy,
  StatusFilter,
} from './dto';
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

  async create(
    dto: CreateWorkDto,
    authorId: string,
  ): Promise<WorkWithRelations> {
    const work = await this.prisma.work.create({
      data: {
        title: dto.title,
        description: dto.description,
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

    const statusFilter = query.statusFilter ?? StatusFilter.PUBLISHED;

    const where: Prisma.WorkWhereInput = {};

    if (statusFilter === StatusFilter.PUBLISHED) {
      where.status = WorkStatus.PUBLISHED;
      where.isPublic = true;
    } else if (statusFilter === StatusFilter.IN_PROGRESS) {
      where.status = { notIn: [WorkStatus.PUBLISHED, WorkStatus.DRAFT] };
    }
    // ALL: no status filter

    if (query.category) where.category = query.category;
    if (query.year) where.year = query.year;
    if (query.supervisorId) where.supervisorId = query.supervisorId;
    if (query.status) where.status = query.status;
    if (query.minScore !== undefined || query.maxScore !== undefined) {
      where.qualityScore = {};
      if (query.minScore !== undefined) where.qualityScore.gte = query.minScore;
      if (query.maxScore !== undefined) where.qualityScore.lte = query.maxScore;
    }

    let orderBy: Prisma.WorkOrderByWithRelationInput;
    switch (query.sortBy) {
      case SortBy.OLDEST:
        orderBy = { createdAt: 'asc' };
        break;
      case SortBy.SCORE_DESC:
        orderBy = { qualityScore: 'desc' };
        break;
      case SortBy.SCORE_ASC:
        orderBy = { qualityScore: 'asc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const inProgressInclude = {
      author: { select: { id: true, fullName: true, email: true } },
      supervisor: { select: { id: true, fullName: true, email: true } },
      _count: { select: { reviews: true, comments: true } },
    } satisfies Prisma.WorkInclude;

    const includeToUse =
      statusFilter === StatusFilter.IN_PROGRESS ? inProgressInclude : workInclude;

    const [data, total] = await Promise.all([
      this.prisma.work.findMany({
        where,
        include: includeToUse,
        skip,
        take: limit,
        orderBy,
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

    if (
      work.authorId !== user.id &&
      work.supervisorId !== user.id &&
      user.role !== Role.ADMIN
    ) {
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

    const updateData: Prisma.WorkUpdateInput = { status: dto.status };
    if (dto.status === WorkStatus.PUBLISHED) {
      updateData.isPublic = true;
    }

    const updated = await this.prisma.work.update({
      where: { id },
      data: updateData,
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

  async getStages(workId: string): Promise<WorkStage[]> {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) {
      throw new NotFoundException('Работа не найдена');
    }

    return this.prisma.workStage.findMany({
      where: { workId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateStage(
    workId: string,
    stageId: string,
    dto: UpdateStageDto,
    user: User,
  ): Promise<WorkStage> {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) {
      throw new NotFoundException('Работа не найдена');
    }

    if (
      work.authorId !== user.id &&
      work.supervisorId !== user.id &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException('Нет прав для изменения этапов');
    }

    const stage = await this.prisma.workStage.findUnique({
      where: { id: stageId },
    });
    if (!stage || stage.workId !== workId) {
      throw new NotFoundException('Этап не найден');
    }

    return this.prisma.workStage.update({
      where: { id: stageId },
      data: {
        isCompleted: dto.isCompleted,
        completedAt: dto.isCompleted ? new Date() : null,
      },
    });
  }
}
