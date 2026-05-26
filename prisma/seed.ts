import { PrismaClient, Role, WorkStatus, TopicRequestStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const TEST_IDS = {
  workTitle: 'Дипломная работа для теста рецензирования',
  authorEmail: 'student.review.test@example.com',
  supervisorEmail: 'supervisor.review.test@example.com',
  reviewerEmailPrefix: 'reviewer',
};

const criteriaTemplate = {
  novelty: 8,
  methodology: 8,
  practicalValue: 9,
  formatting: 8,
  defense: 8,
};

const weightsTemplate = {
  novelty: 0.2,
  methodology: 0.25,
  practicalValue: 0.2,
  formatting: 0.15,
  defense: 0.2,
};

async function upsertUser(params: {
  email: string;
  fullName: string;
  role: Role;
  group?: string | null;
  specialization?: string | null;
}) {
  const passwordHash = await bcrypt.hash('Test12345!', 10);
  return prisma.user.upsert({
    where: { email: params.email },
    update: {
      fullName: params.fullName,
      role: params.role,
      group: params.group ?? null,
      specialization: params.specialization ?? null,
      isApproved: true,
      isBlocked: false,
      passwordHash,
    },
    create: {
      email: params.email,
      fullName: params.fullName,
      role: params.role,
      group: params.group ?? null,
      specialization: params.specialization ?? null,
      isApproved: true,
      isBlocked: false,
      passwordHash,
    },
  });
}

async function main(): Promise<void> {
  const author = await upsertUser({
    email: TEST_IDS.authorEmail,
    fullName: 'Тестовый студент Диплом',
    role: Role.STUDENT,
    group: 'ИС-01',
  });

  const supervisor = await upsertUser({
    email: TEST_IDS.supervisorEmail,
    fullName: 'Тестовый научный руководитель',
    role: Role.SUPERVISOR,
    specialization: 'Информационные системы',
  });

  const reviewerSpecs = [
    { fullName: 'Профессор Альфа', score: 0.91, comment: 'Работа сильная, допускаю к защите без замечаний.' },
    { fullName: 'Доцент Бета', score: 0.84, comment: 'Хорошая структура и убедительная практическая часть.' },
    { fullName: 'Профессор Гамма', score: 0.78, comment: 'Есть замечания по оформлению, но в целом работа достойная.' },
    { fullName: 'Доцент Дельта', score: 0.73, comment: 'Методология корректная, но защита требует доработки выступления.' },
    { fullName: 'Профессор Эпсилон', score: 0.67, comment: 'Работа допустима, но теоретическая база могла быть глубже.' },
    { fullName: 'Доцент Дзета', score: 0.62, comment: 'Результаты интересные, однако есть вопросы к оформлению.' },
    { fullName: 'Профессор Эта', score: 0.58, comment: 'Работа удовлетворительная, но аргументация местами слабая.' },
    { fullName: 'Доцент Тета', score: 0.53, comment: 'Тема раскрыта частично, требуется более тщательная проработка.' },
    { fullName: 'Профессор Йота', score: 0.49, comment: 'Материал неоднородный, защита в текущем виде на грани допуска.' },
    { fullName: 'Доцент Каппа', score: 0.44, comment: 'Есть значимые замечания, но для теста рецензирования этого достаточно.' },
  ];

  const supervisorReviewSpec = {
    score: 0.87,
    comment: 'Как научный руководитель подтверждаю готовность работы к защите.',
  };

  const reviewers = [];
  for (let i = 0; i < reviewerSpecs.length; i += 1) {
    const spec = reviewerSpecs[i];
    const reviewer = await upsertUser({
      email: `${TEST_IDS.reviewerEmailPrefix}${i + 1}@example.com`,
      fullName: spec.fullName,
      role: Role.SUPERVISOR,
      specialization: 'Рецензент',
    });
    reviewers.push(reviewer);
  }

  await prisma.review.deleteMany({ where: { work: { title: TEST_IDS.workTitle } } });
  await prisma.workStage.deleteMany({ where: { work: { title: TEST_IDS.workTitle } } });
  await prisma.work.deleteMany({ where: { title: TEST_IDS.workTitle } });

  const work = await prisma.work.create({
    data: {
      title: TEST_IDS.workTitle,
      description: 'Тестовая дипломная работа для локальной проверки полного цикла рецензирования.',
      annotation: 'Локальный тестовый объект для проверки рецензий и финализации защиты.',
      category: 'Информационные системы',
      tags: ['test', 'review', 'graduation'],
      year: new Date().getFullYear(),
      authorId: author.id,
      supervisorId: supervisor.id,
      status: WorkStatus.REVIEW,
      isPublic: false,
    },
  });

  await prisma.workStage.createMany({
    data: [
      { workId: work.id, name: 'Выбор темы', isCompleted: true },
      { workId: work.id, name: 'Утверждение', isCompleted: true },
      { workId: work.id, name: 'Черновик', isCompleted: true },
      { workId: work.id, name: 'Рецензия', isCompleted: true },
      { workId: work.id, name: 'Защита', isCompleted: false },
      { workId: work.id, name: 'Публикация', isCompleted: false },
    ],
  });

  const createdReviews = [];

  const supervisorReview = await prisma.review.create({
    data: {
      workId: work.id,
      reviewerId: supervisor.id,
      criteria: criteriaTemplate,
      weights: weightsTemplate,
      comment: supervisorReviewSpec.comment,
      totalScore: supervisorReviewSpec.score,
      isFinalized: true,
      isCommissionReview: true,
    },
  });
  createdReviews.push(supervisorReview);

  for (let i = 0; i < reviewers.length; i += 1) {
    const reviewer = reviewers[i];
    const score = reviewerSpecs[i].score;
    const base = Math.round(score * 10);
    const criteria = {
      novelty: Math.max(1, Math.min(10, base)),
      methodology: Math.max(1, Math.min(10, base - 1)),
      practicalValue: Math.max(1, Math.min(10, base + 1)),
      formatting: Math.max(1, Math.min(10, base - (i % 3))),
      defense: Math.max(1, Math.min(10, base - (i % 2))),
    };

    const review = await prisma.review.create({
      data: {
        workId: work.id,
        reviewerId: reviewer.id,
        criteria,
        weights: weightsTemplate,
        comment: reviewerSpecs[i].comment,
        totalScore: score,
        isFinalized: i === 0,
        isCommissionReview: false,
      },
    });
    createdReviews.push(review);
  }

  const supervisorAvg = supervisorReview.totalScore;
  const externalReviews = createdReviews.filter(
    (review) => review.reviewerId !== supervisor.id,
  );
  const externalAvg =
    externalReviews.reduce((sum, review) => sum + review.totalScore, 0) /
    externalReviews.length;

  await prisma.work.update({
    where: { id: work.id },
    data: {
      commissionReviewScore: Math.round(supervisorAvg * 100) / 100,
      externalReviewScore: Math.round(externalAvg * 100) / 100,
      status: WorkStatus.DEFENSE,
      isPublic: true,
    },
  });

  await prisma.reviewCriteriaConfig.upsert({
    where: {
      id: 'seed-review-criteria',
    },
    update: {
      name: 'Качество защиты',
      description: 'Тестовый критерий для локальной проверки рецензирования',
      weight: 1.5,
      maxScore: 10,
      isActive: true,
      orderIndex: 9,
    },
    create: {
      id: 'seed-review-criteria',
      name: 'Качество защиты',
      description: 'Тестовый критерий для локальной проверки рецензирования',
      weight: 1.5,
      maxScore: 10,
      isActive: true,
      orderIndex: 9,
    },
  });

  await prisma.topicRequest.upsert({
    where: {
      id: 'seed-topic-request',
    },
    update: {
      status: TopicRequestStatus.APPROVED,
      proposedTopic: 'Тестовая тема для проверки рецензирования',
      justification: 'Создано для локального end-to-end сценария.',
      studentId: author.id,
      supervisorId: supervisor.id,
    },
    create: {
      id: 'seed-topic-request',
      proposedTopic: 'Тестовая тема для проверки рецензирования',
      justification: 'Создано для локального end-to-end сценария.',
      status: TopicRequestStatus.APPROVED,
      studentId: author.id,
      supervisorId: supervisor.id,
    },
  });

  const allWorks = await prisma.work.findMany({
    include: {
      reviews: true,
      supervisor: { select: { id: true } },
    },
  });

  for (const item of allWorks) {
    const commission = item.reviews.filter(
      (review) => review.reviewerId === item.supervisorId,
    );
    const external = item.reviews.filter(
      (review) => review.reviewerId !== item.supervisorId,
    );

    const commissionReviewScore =
      commission.length > 0
        ? Math.round(
            (commission.reduce((sum, review) => sum + review.totalScore, 0) /
              commission.length) *
              100,
          ) / 100
        : null;
    const externalReviewScore =
      external.length > 0
        ? Math.round(
            (external.reduce((sum, review) => sum + review.totalScore, 0) /
              external.length) *
              100,
          ) / 100
        : null;

    await prisma.work.update({
      where: { id: item.id },
      data: {
        commissionReviewScore,
        externalReviewScore,
      },
    });
  }

  console.log(
    `Seed complete: work=${work.id}, reviews=${createdReviews.length}, commission=${Math.round(supervisorAvg * 100) / 100}, external=${Math.round(externalAvg * 100) / 100}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
