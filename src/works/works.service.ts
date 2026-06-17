import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Role, User, WorkStatus, WorkStage, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma';
import { NotificationsService } from '../notifications/notifications.service';
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
import { normalizeFileNameEncoding } from '../files/file-name.utils';

const workInclude = {
  author: { select: { id: true, fullName: true, email: true } },
  supervisor: { select: { id: true, fullName: true, email: true } },
  files: {
    select: {
      id: true,
      type: true,
      originalName: true,
      url: true,
      size: true,
      version: true,
      comment: true,
      createdAt: true,
    },
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
  },
  _count: { select: { reviews: true, comments: true } },
} satisfies Prisma.WorkInclude;

const WORK_STATUS_FLOW: WorkStatus[] = [
  WorkStatus.TOPIC_SELECTED,
  WorkStatus.APPROVED,
  WorkStatus.IN_PROGRESS,
  WorkStatus.REVIEW,
  WorkStatus.NEEDS_REVISION,
  WorkStatus.DEFENSE,
  WorkStatus.PUBLISHED,
];

const ALLOWED_STATUS_TRANSITIONS: Partial<Record<WorkStatus, WorkStatus[]>> = {
  [WorkStatus.DRAFT]: [WorkStatus.TOPIC_SELECTED],
  [WorkStatus.TOPIC_SELECTED]: [WorkStatus.APPROVED],
  [WorkStatus.APPROVED]: [WorkStatus.IN_PROGRESS],
  [WorkStatus.IN_PROGRESS]: [WorkStatus.REVIEW],
  [WorkStatus.REVIEW]: [WorkStatus.NEEDS_REVISION, WorkStatus.DEFENSE],
  [WorkStatus.NEEDS_REVISION]: [WorkStatus.REVIEW],
  [WorkStatus.DEFENSE]: [WorkStatus.PUBLISHED],
  [WorkStatus.PUBLISHED]: [],
  [WorkStatus.ARCHIVED]: [],
};

@Injectable()
export class WorksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private canManageWork(
    work: { authorId: string; supervisorId: string | null },
    user: User,
  ): boolean {
    return (
      user.role === Role.ADMIN ||
      work.authorId === user.id ||
      (user.role === Role.SUPERVISOR && work.supervisorId === user.id)
    );
  }

  async create(
    dto: CreateWorkDto,
    authorId: string,
  ): Promise<WorkWithRelations> {
    if (!dto.supervisorId) {
      throw new BadRequestException('Выберите преподавателя');
    }

    const supervisor = await this.prisma.user.findUnique({
      where: { id: dto.supervisorId },
      select: { id: true, fullName: true, role: true },
    });

    if (!supervisor || supervisor.role !== Role.SUPERVISOR) {
      throw new BadRequestException('Указанный преподаватель не найден');
    }

    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { fullName: true, group: true },
    });

    const work = await this.prisma.work.create({
      data: {
        title: dto.title,
        description: dto.description,
        annotation: dto.annotation,
        category: dto.category,
        tags: dto.tags ?? [],
        year: dto.year,
        status: WorkStatus.TOPIC_SELECTED,
        authorId,
        supervisorId: dto.supervisorId,
      },
      include: workInclude,
    });

    // Create default stages
    const stages = [
      'Тема выбрана',
      'Тема утверждена',
      'Работа в процессе написания',
      'Финальная проверка',
      'Требуются доработки',
      'Допущена к защите',
      'Работа завершена',
    ];

    await this.prisma.workStage.createMany({
      data: stages.map((name) => ({ name, workId: work.id })),
    });

    await this.notifications.create({
      userId: supervisor.id,
      type: 'WORK_SUPERVISION_REQUEST',
      title: 'Новый запрос на руководство',
      message: `Студент ${author?.fullName ?? 'Неизвестный'} хочет выполнять работу «${work.title}» под вашим руководством.`,
      data: {
        workId: work.id,
        studentId: authorId,
        studentName: author?.fullName ?? '',
        studentGroup: author?.group ?? '',
      },
    });

    return this.normalizeWorkFileNames(work as WorkWithRelations);
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
      where.commissionReviewScore = {};
      if (query.minScore !== undefined)
        where.commissionReviewScore.gte = query.minScore;
      if (query.maxScore !== undefined)
        where.commissionReviewScore.lte = query.maxScore;
    }

    let orderBy: Prisma.WorkOrderByWithRelationInput;
    switch (query.sortBy) {
      case SortBy.OLDEST:
        orderBy = { createdAt: 'asc' };
        break;
      case SortBy.SCORE_DESC:
        orderBy = { commissionReviewScore: 'desc' };
        break;
      case SortBy.SCORE_ASC:
        orderBy = { commissionReviewScore: 'asc' };
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
      statusFilter === StatusFilter.IN_PROGRESS
        ? inProgressInclude
        : workInclude;

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
      data: (data as WorkWithRelations[]).map((work) =>
        this.normalizeWorkFileNames(work),
      ),
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
      data: (data as WorkWithRelations[]).map((work) =>
        this.normalizeWorkFileNames(work),
      ),
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

    return this.normalizeWorkFileNames(work as WorkWithRelations);
  }

  async findByAuthor(authorId: string): Promise<WorkWithRelations[]> {
    const works = await this.prisma.work.findMany({
      where: { authorId },
      include: workInclude,
      orderBy: { createdAt: 'desc' },
    });
    return (works as WorkWithRelations[]).map((work) =>
      this.normalizeWorkFileNames(work),
    );
  }

  async findBySupervisor(supervisorId: string): Promise<WorkWithRelations[]> {
    const works = await this.prisma.work.findMany({
      where: { supervisorId },
      include: workInclude,
      orderBy: { createdAt: 'desc' },
    });
    return (works as WorkWithRelations[]).map((work) =>
      this.normalizeWorkFileNames(work),
    );
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

    if (!this.canManageWork(work, user)) {
      throw new ForbiddenException('Нет прав для редактирования');
    }

    const updated = await this.prisma.work.update({
      where: { id },
      data: dto,
      include: workInclude,
    });

    return this.normalizeWorkFileNames(updated as WorkWithRelations);
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

    if (work.supervisorId !== user.id) {
      throw new ForbiddenException('Нет прав для изменения статуса');
    }

    if (dto.status === work.status) {
      return this.normalizeWorkFileNames(
        (await this.prisma.work.findUnique({
          where: { id },
          include: workInclude,
        })) as WorkWithRelations,
      );
    }

    const allowedNextStatuses = ALLOWED_STATUS_TRANSITIONS[work.status] ?? [];
    if (!allowedNextStatuses.includes(dto.status)) {
      throw new BadRequestException(
        'Недопустимый переход статуса для текущего этапа работы',
      );
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

    await this.notifyStatusChanged(
      {
        id: work.id,
        title: work.title,
        authorId: work.authorId,
        supervisorId: work.supervisorId,
      },
      dto.status,
      user,
    );

    return this.normalizeWorkFileNames(updated as WorkWithRelations);
  }

  async delete(id: string, user: User): Promise<void> {
    const work = await this.prisma.work.findUnique({
      where: { id },
      include: {
        topicResponse: {
          select: {
            id: true,
            topicId: true,
          },
        },
      },
    });
    if (!work) {
      throw new NotFoundException('Работа не найдена');
    }

    if (work.authorId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Нет прав для удаления');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.work.delete({ where: { id } });

      if (work.topicResponse?.topicId) {
        await tx.supervisorTopic.delete({
          where: { id: work.topicResponse.topicId },
        });
      }
    });
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

    if (work.status === WorkStatus.PUBLISHED) {
      throw new ForbiddenException(
        'Этапы опубликованной работы нельзя изменять',
      );
    }

    if (work.supervisorId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Этапы может изменять только преподаватель');
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

  private async notifyStatusChanged(
    work: {
      id: string;
      title: string;
      authorId: string;
      supervisorId: string | null;
    },
    status: WorkStatus,
    actor: User,
  ): Promise<void> {
    const recipients = new Set<string>();
    if (work.authorId !== actor.id) recipients.add(work.authorId);
    if (work.supervisorId && work.supervisorId !== actor.id) {
      recipients.add(work.supervisorId);
    }

    if (recipients.size === 0) return;

    const isPublished = status === WorkStatus.PUBLISHED;
    const title = isPublished ? 'Работа опубликована' : 'Изменён статус ВКР';
    const message = isPublished
      ? `Работа «${work.title}» опубликована в каталоге.`
      : `Статус работы «${work.title}» изменён на ${status}.`;

    await Promise.all(
      [...recipients].map((userId) =>
        this.notifications.create({
          userId,
          type: isPublished ? 'WORK_PUBLISHED' : 'WORK_STATUS_CHANGED',
          title,
          message,
          data: {
            workId: work.id,
            status,
            actorId: actor.id,
            actorName: actor.fullName,
          },
        }),
      ),
    );
  }

  static getStatusFlow(): WorkStatus[] {
    return WORK_STATUS_FLOW;
  }

  private normalizeWorkFileNames(work: WorkWithRelations): WorkWithRelations {
    if (!Array.isArray(work.files)) return work;

    return {
      ...work,
      files: work.files.map((file) => ({
        ...file,
        originalName: normalizeFileNameEncoding(file.originalName),
      })),
    };
  }
}
