import { Injectable, OnModuleInit } from '@nestjs/common';
import { ReviewCriteriaConfig } from '@prisma/client';
import { PrismaService } from '../prisma';

const DEFAULT_CRITERIA = [
  { name: 'Актуальность темы', description: 'Насколько тема актуальна и значима для современной науки и практики', weight: 1.5, orderIndex: 0 },
  { name: 'Научная новизна', description: 'Наличие оригинального вклада в науку, новых идей или подходов', weight: 2.0, orderIndex: 1 },
  { name: 'Глубина теоретического анализа', description: 'Полнота и глубина обзора литературы, теоретической базы', weight: 1.5, orderIndex: 2 },
  { name: 'Корректность методологии', description: 'Обоснованность выбора методов исследования, их соответствие задачам', weight: 2.0, orderIndex: 3 },
  { name: 'Качество эмпирических данных', description: 'Достаточность выборки, достоверность и валидность данных', weight: 1.5, orderIndex: 4 },
  { name: 'Логика и структура изложения', description: 'Последовательность, связность и чёткость изложения материала', weight: 1.0, orderIndex: 5 },
  { name: 'Качество оформления', description: 'Соответствие нормам оформления, грамотность, наличие иллюстраций', weight: 0.5, orderIndex: 6 },
  { name: 'Самостоятельность работы', description: 'Степень самостоятельности студента, оригинальность авторской позиции', weight: 1.5, orderIndex: 7 },
  { name: 'Практическая значимость', description: 'Возможность применения результатов на практике', weight: 1.0, orderIndex: 8 },
  { name: 'Качество защиты', description: 'Качество доклада, ответов на вопросы, умение отстаивать позицию', weight: 1.5, orderIndex: 9 },
];

@Injectable()
export class ReviewCriteriaService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const count = await this.prisma.reviewCriteriaConfig.count();
    if (count === 0) {
      await this.prisma.reviewCriteriaConfig.createMany({
        data: DEFAULT_CRITERIA.map((c) => ({
          ...c,
          maxScore: 10,
          isActive: true,
        })),
      });
    }
  }

  async findAll(): Promise<ReviewCriteriaConfig[]> {
    return this.prisma.reviewCriteriaConfig.findMany({
      where: { isActive: true },
      orderBy: { orderIndex: 'asc' },
    });
  }
}
