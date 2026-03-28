import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { StudentPortfolioItem } from '@prisma/client';
import { PrismaService } from '../prisma';
import { CreatePortfolioItemDto, UpdatePortfolioItemDto } from './dto';

@Injectable()
export class PortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    studentId: string,
    dto: CreatePortfolioItemDto,
  ): Promise<StudentPortfolioItem> {
    return this.prisma.studentPortfolioItem.create({
      data: {
        title: dto.title,
        type: dto.type,
        description: dto.description,
        year: dto.year,
        grade: dto.grade,
        studentId,
      },
    });
  }

  async findByStudent(studentId: string): Promise<StudentPortfolioItem[]> {
    return this.prisma.studentPortfolioItem.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    itemId: string,
    studentId: string,
    dto: UpdatePortfolioItemDto,
  ): Promise<StudentPortfolioItem> {
    const item = await this.prisma.studentPortfolioItem.findUnique({
      where: { id: itemId },
    });

    if (!item) throw new NotFoundException('Элемент портфолио не найден');
    if (item.studentId !== studentId)
      throw new ForbiddenException('Нет прав для редактирования');

    return this.prisma.studentPortfolioItem.update({
      where: { id: itemId },
      data: dto,
    });
  }

  async delete(itemId: string, studentId: string): Promise<void> {
    const item = await this.prisma.studentPortfolioItem.findUnique({
      where: { id: itemId },
    });

    if (!item) throw new NotFoundException('Элемент портфолио не найден');
    if (item.studentId !== studentId)
      throw new ForbiddenException('Нет прав для удаления');

    await this.prisma.studentPortfolioItem.delete({ where: { id: itemId } });
  }

  async setFileUrl(
    itemId: string,
    studentId: string,
    fileUrl: string,
  ): Promise<StudentPortfolioItem> {
    const item = await this.prisma.studentPortfolioItem.findUnique({
      where: { id: itemId },
    });

    if (!item) throw new NotFoundException('Элемент портфолио не найден');
    if (item.studentId !== studentId)
      throw new ForbiddenException('Нет прав');

    return this.prisma.studentPortfolioItem.update({
      where: { id: itemId },
      data: { fileUrl },
    });
  }
}
