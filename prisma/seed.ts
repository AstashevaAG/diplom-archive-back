import {
  FileType,
  PortfolioItemType,
  PrismaClient,
  Role,
  TopicRequestStatus,
  TopicResponseStatus,
  WorkStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const PASSWORD = 'Test12345!';

const criteriaSeed = [
  {
    key: 'relevance',
    name: 'Актуальность темы',
    description:
      'Соответствие темы современным задачам практической психологии и запросам профессионального сообщества.',
    weight: 1.5,
  },
  {
    key: 'novelty',
    name: 'Научная новизна',
    description:
      'Наличие самостоятельной исследовательской позиции, новых выводов или оригинального применения методик.',
    weight: 2,
  },
  {
    key: 'theory',
    name: 'Глубина теоретического анализа',
    description:
      'Качество обзора источников, логика теоретической главы и связь теории с исследовательскими задачами.',
    weight: 1.5,
  },
  {
    key: 'methodology',
    name: 'Корректность методологии',
    description:
      'Обоснованность выборки, методов сбора данных, диагностического инструментария и процедуры исследования.',
    weight: 2,
  },
  {
    key: 'trainingPresentation',
    name: 'Тренинговое выступление и контакт с аудиторией',
    description:
      'Умение вести себя в формате тренинга на защите: удерживать внимание аудитории, выстраивать уверенное повествование, использовать голос и интонацию, отвечать на вопросы и поддерживать контакт со слушателями.',
    weight: 1.5,
  },
  {
    key: 'structure',
    name: 'Логика и структура изложения',
    description:
      'Последовательность глав, связность аргументации, качество выводов и соответствие цели исследования.',
    weight: 1,
  },
  {
    key: 'formatting',
    name: 'Качество оформления',
    description:
      'Соответствие требованиям оформления, грамотность, корректность ссылок, таблиц, рисунков и приложений.',
    weight: 0.5,
  },
  {
    key: 'independence',
    name: 'Самостоятельность работы',
    description:
      'Авторская позиция студента, самостоятельность анализа и отсутствие признаков формального компилирования.',
    weight: 1.5,
  },
  {
    key: 'practicalValue',
    name: 'Практическая значимость',
    description:
      'Применимость результатов в консультировании, образовании, HR, семейной или клинической практике.',
    weight: 1,
  },
  {
    key: 'defense',
    name: 'Качество защиты',
    description:
      'Структура доклада, качество презентации, ответы на вопросы и способность аргументировать решения.',
    weight: 1.5,
  },
];

const supervisorSeeds = [
  {
    email: 'elena.morozova@diplom.local',
    fullName: 'Морозова Елена Викторовна',
    specialization: 'Семейная психология и консультирование',
    bio: 'Кандидат психологических наук, супервизор семейных консультантов. Руководит исследованиями о детско-родительских отношениях, брачных кризисах и эмоциональной регуляции в семье.',
  },
  {
    email: 'andrey.sokolov@diplom.local',
    fullName: 'Соколов Андрей Павлович',
    specialization: 'Организационная психология и HR-аналитика',
    bio: 'Практикующий организационный консультант. Курирует проекты о выгорании, вовлеченности сотрудников, лидерстве и адаптации молодых специалистов.',
  },
  {
    email: 'irina.petrova@diplom.local',
    fullName: 'Петрова Ирина Сергеевна',
    specialization: 'Клиническая психология и психодиагностика',
    bio: 'Специалист по психодиагностике и сопровождению клиентов с тревожными и депрессивными состояниями. Особое внимание уделяет этике исследований.',
  },
  {
    email: 'mikhail.volkov@diplom.local',
    fullName: 'Волков Михаил Аркадьевич',
    specialization: 'Когнитивно-поведенческий подход',
    bio: 'Преподаватель практических курсов по КПТ. Руководит работами о когнитивных искажениях, эмоциональной саморегуляции и протоколах помощи.',
  },
  {
    email: 'natalia.lebedeva@diplom.local',
    fullName: 'Лебедева Наталья Олеговна',
    specialization: 'Психология образования и подросткового возраста',
    bio: 'Исследует учебную мотивацию, школьную тревожность и психологическую безопасность образовательной среды.',
  },
  {
    email: 'roman.kuznetsov@diplom.local',
    fullName: 'Кузнецов Роман Игоревич',
    specialization: 'Цифровая психология и онлайн-консультирование',
    bio: 'Занимается цифровыми сервисами психологической помощи, этикой онлайн-консультирования и анализом пользовательского опыта.',
  },
  {
    email: 'olga.fedorova@diplom.local',
    fullName: 'Федорова Ольга Николаевна',
    specialization: 'Арт-терапия и телесно-ориентированные практики',
    bio: 'Руководит прикладными исследованиями о творческих методах сопровождения взрослых и подростков.',
  },
  {
    email: 'sergey.orlov@diplom.local',
    fullName: 'Орлов Сергей Михайлович',
    specialization: 'Психометрика и исследовательский дизайн',
    bio: 'Методолог, консультирует дипломников по статистике, валидности методик и построению эмпирических исследований.',
  },
];

const studentSeeds = [
  ['anna.ivanova@diplom.local', 'Иванова Анна Сергеевна', 'ПП-21'],
  ['maria.smirnova@diplom.local', 'Смирнова Мария Дмитриевна', 'ПП-21'],
  ['daria.karpova@diplom.local', 'Карпова Дарья Андреевна', 'ПП-21'],
  ['nikita.egorov@diplom.local', 'Егоров Никита Александрович', 'ПП-21'],
  ['alina.belova@diplom.local', 'Белова Алина Романовна', 'ПП-22'],
  ['kirill.zhukov@diplom.local', 'Жуков Кирилл Олегович', 'ПП-22'],
  ['ekaterina.nikolaeva@diplom.local', 'Николаева Екатерина Павловна', 'ПП-22'],
  ['timofey.larin@diplom.local', 'Ларин Тимофей Денисович', 'ПП-22'],
  ['polina.markova@diplom.local', 'Маркова Полина Ильинична', 'ПП-23'],
  ['lev.gromov@diplom.local', 'Громов Лев Максимович', 'ПП-23'],
  ['sofia.melnikova@diplom.local', 'Мельникова Софья Игоревна', 'ПП-23'],
  ['arseny.titov@diplom.local', 'Титов Арсений Евгеньевич', 'ПП-23'],
  ['valeria.orshina@diplom.local', 'Орщина Валерия Павловна', 'ПП-24'],
  ['ilya.savin@diplom.local', 'Савин Илья Константинович', 'ПП-24'],
  ['uliana.krylova@diplom.local', 'Крылова Ульяна Матвеевна', 'ПП-24'],
  ['gleb.mironov@diplom.local', 'Миронов Глеб Артемович', 'ПП-24'],
] as const;

const graduateSeeds = [
  ['ksenia.borisova@diplom.local', 'Борисова Ксения Владиславовна', 'ПП-20'],
  ['pavel.antonov@diplom.local', 'Антонов Павел Русланович', 'ПП-20'],
  ['vera.zimina@diplom.local', 'Зимина Вера Алексеевна', 'ПП-19'],
  ['denis.ustinov@diplom.local', 'Устинов Денис Маркович', 'ПП-19'],
  ['lada.safonova@diplom.local', 'Сафонова Лада Кирилловна', 'ПП-18'],
  ['matvey.gusev@diplom.local', 'Гусев Матвей Ильич', 'ПП-18'],
] as const;

const workSeeds = [
  {
    student: 'anna.ivanova@diplom.local',
    supervisor: 'elena.morozova@diplom.local',
    title: 'Связь семейного климата и самооценки подростков',
    category: 'Семейная психология',
    tags: ['семья', 'подростки', 'самооценка', 'родители'],
    status: WorkStatus.PUBLISHED,
    year: 2025,
    score: 91,
    views: 842,
  },
  {
    student: 'maria.smirnova@diplom.local',
    supervisor: 'andrey.sokolov@diplom.local',
    title: 'Факторы профессионального выгорания у начинающих HR-специалистов',
    category: 'Организационная психология',
    tags: ['выгорание', 'HR', 'адаптация', 'стресс'],
    status: WorkStatus.PUBLISHED,
    year: 2025,
    score: 87,
    views: 633,
  },
  {
    student: 'daria.karpova@diplom.local',
    supervisor: 'irina.petrova@diplom.local',
    title: 'Особенности тревожности у студентов первого курса',
    category: 'Клиническая психология',
    tags: ['тревожность', 'студенты', 'адаптация', 'психодиагностика'],
    status: WorkStatus.DEFENSE,
    year: 2026,
    score: 82,
    views: 214,
  },
  {
    student: 'nikita.egorov@diplom.local',
    supervisor: 'mikhail.volkov@diplom.local',
    title: 'Когнитивные искажения как фактор прокрастинации у молодых взрослых',
    category: 'Когнитивная психология',
    tags: ['КПТ', 'прокрастинация', 'мышление', 'саморегуляция'],
    status: WorkStatus.REVIEW,
    year: 2026,
    score: 76,
    views: 148,
  },
  {
    student: 'alina.belova@diplom.local',
    supervisor: 'natalia.lebedeva@diplom.local',
    title: 'Школьная тревожность и учебная мотивация у подростков',
    category: 'Психология образования',
    tags: ['школа', 'мотивация', 'подростки', 'тревожность'],
    status: WorkStatus.IN_PROGRESS,
    year: 2026,
    score: null,
    views: 92,
  },
  {
    student: 'kirill.zhukov@diplom.local',
    supervisor: 'roman.kuznetsov@diplom.local',
    title: 'Доверие клиентов к онлайн-консультированию',
    category: 'Цифровая психология',
    tags: ['онлайн-консультирование', 'доверие', 'цифровые сервисы'],
    status: WorkStatus.REVIEW,
    year: 2026,
    score: 79,
    views: 187,
  },
  {
    student: 'ekaterina.nikolaeva@diplom.local',
    supervisor: 'olga.fedorova@diplom.local',
    title: 'Арт-терапевтические методы снижения эмоционального напряжения',
    category: 'Арт-терапия',
    tags: ['арт-терапия', 'эмоции', 'стресс', 'практика'],
    status: WorkStatus.APPROVED,
    year: 2026,
    score: null,
    views: 51,
  },
  {
    student: 'timofey.larin@diplom.local',
    supervisor: 'sergey.orlov@diplom.local',
    title: 'Валидизация краткой шкалы академической устойчивости',
    category: 'Психометрика',
    tags: ['психометрика', 'валидность', 'опросник', 'статистика'],
    status: WorkStatus.REVIEW,
    year: 2026,
    score: 84,
    views: 169,
  },
  {
    student: 'polina.markova@diplom.local',
    supervisor: 'elena.morozova@diplom.local',
    title: 'Роль эмоциональной поддержки в адаптации молодых супругов',
    category: 'Семейная психология',
    tags: ['брак', 'поддержка', 'адаптация', 'семья'],
    status: WorkStatus.TOPIC_SELECTED,
    year: 2026,
    score: null,
    views: 27,
  },
  {
    student: 'lev.gromov@diplom.local',
    supervisor: 'andrey.sokolov@diplom.local',
    title: 'Психологические предикторы вовлеченности сотрудников в гибридных командах',
    category: 'Организационная психология',
    tags: ['гибридная работа', 'вовлеченность', 'команды', 'лидерство'],
    status: WorkStatus.IN_PROGRESS,
    year: 2026,
    score: null,
    views: 75,
  },
  {
    student: 'sofia.melnikova@diplom.local',
    supervisor: 'irina.petrova@diplom.local',
    title: 'Особенности копинг-стратегий у клиентов с высоким уровнем тревоги',
    category: 'Клиническая психология',
    tags: ['копинг', 'тревога', 'консультирование', 'стресс'],
    status: WorkStatus.DRAFT,
    year: 2026,
    score: null,
    views: 12,
  },
  {
    student: 'arseny.titov@diplom.local',
    supervisor: 'roman.kuznetsov@diplom.local',
    title: 'UX-факторы удержания пользователей в сервисах психологической самопомощи',
    category: 'Цифровая психология',
    tags: ['UX', 'самопомощь', 'мобильные приложения', 'поведение'],
    status: WorkStatus.APPROVED,
    year: 2026,
    score: null,
    views: 46,
  },
  {
    student: 'ksenia.borisova@diplom.local',
    supervisor: 'natalia.lebedeva@diplom.local',
    title: 'Психологическая безопасность образовательной среды старших классов',
    category: 'Психология образования',
    tags: ['безопасность', 'школа', 'подростки', 'климат'],
    status: WorkStatus.PUBLISHED,
    year: 2024,
    score: 88,
    views: 1205,
  },
  {
    student: 'pavel.antonov@diplom.local',
    supervisor: 'mikhail.volkov@diplom.local',
    title: 'Эффективность дневника мыслей в снижении повседневной тревоги',
    category: 'Когнитивная психология',
    tags: ['КПТ', 'дневник мыслей', 'тревога', 'самонаблюдение'],
    status: WorkStatus.PUBLISHED,
    year: 2024,
    score: 93,
    views: 987,
  },
  {
    student: 'vera.zimina@diplom.local',
    supervisor: 'olga.fedorova@diplom.local',
    title: 'Телесно-ориентированные практики в работе с эмоциональным выгоранием',
    category: 'Арт-терапия',
    tags: ['телесные практики', 'выгорание', 'эмоции', 'помощь'],
    status: WorkStatus.PUBLISHED,
    year: 2023,
    score: 85,
    views: 754,
  },
  {
    student: 'denis.ustinov@diplom.local',
    supervisor: 'sergey.orlov@diplom.local',
    title: 'Сравнение шкал субъективного благополучия у взрослых респондентов',
    category: 'Психометрика',
    tags: ['благополучие', 'шкалы', 'статистика', 'методики'],
    status: WorkStatus.PUBLISHED,
    year: 2023,
    score: 89,
    views: 611,
  },
  {
    student: 'lada.safonova@diplom.local',
    supervisor: 'elena.morozova@diplom.local',
    title: 'Семейные сценарии и выбор карьерной траектории у молодых взрослых',
    category: 'Семейная психология',
    tags: ['семейные сценарии', 'карьера', 'молодые взрослые'],
    status: WorkStatus.PUBLISHED,
    year: 2022,
    score: 81,
    views: 402,
  },
  {
    student: 'matvey.gusev@diplom.local',
    supervisor: 'andrey.sokolov@diplom.local',
    title: 'Роль обратной связи руководителя в снижении текучести стажеров',
    category: 'Организационная психология',
    tags: ['обратная связь', 'стажеры', 'текучесть', 'менеджмент'],
    status: WorkStatus.PUBLISHED,
    year: 2022,
    score: 78,
    views: 563,
  },
];

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function clamp(value: number, min = 1, max = 10): number {
  return Math.max(min, Math.min(max, value));
}

function makeCriteria(score: number): Record<string, number> {
  const base = Math.round(score / 10);
  return {
    relevance: clamp(base + 1),
    novelty: clamp(base),
    theory: clamp(base - 1),
    methodology: clamp(base),
    trainingPresentation: clamp(base),
    structure: clamp(base + (score > 85 ? 1 : 0)),
    formatting: clamp(base - (score < 82 ? 1 : 0)),
    independence: clamp(base),
    practicalValue: clamp(base + (score > 88 ? 1 : 0)),
    defense: clamp(base),
  };
}

function calculateScore(criteria: Record<string, number>): number {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const item of criteriaSeed) {
    weightedSum += (criteria[item.key] ?? 0) * item.weight;
    weightTotal += 10 * item.weight;
  }
  return Math.round((weightedSum / weightTotal) * 100 * 100) / 100;
}

async function clearDatabase(): Promise<void> {
  await prisma.topicResponseMessage.deleteMany();
  await prisma.workMessage.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.faqItem.deleteMany();
  await prisma.infoPost.deleteMany();
  await prisma.topicResponse.deleteMany();
  await prisma.supervisorTopic.deleteMany();
  await prisma.studentPortfolioItem.deleteMany();
  await prisma.topicRequest.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.review.deleteMany();
  await prisma.file.deleteMany();
  await prisma.workStage.deleteMany();
  await prisma.work.deleteMany();
  await prisma.reviewCriteriaConfig.deleteMany();
  await prisma.user.deleteMany();
}

async function createUser(params: {
  email: string;
  fullName: string;
  role: Role;
  group?: string | null;
  specialization?: string | null;
  bio?: string | null;
  isApproved?: boolean;
  isBlocked?: boolean;
  createdAt?: Date;
}) {
  return prisma.user.create({
    data: {
      email: params.email,
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      fullName: params.fullName,
      role: params.role,
      group: params.group ?? null,
      specialization: params.specialization ?? null,
      bio: params.bio ?? null,
      avatarUrl: `/avatars/${slug(params.fullName)}.jpg`,
      isApproved: params.isApproved ?? true,
      isBlocked: params.isBlocked ?? false,
      createdAt: params.createdAt ?? daysAgo(180),
    },
  });
}

async function createReview(params: {
  workId: string;
  reviewerId: string;
  targetScore: number;
  comment: string;
  isCommissionReview: boolean;
  createdAt: Date;
  finalized?: boolean;
}) {
  const criteria = makeCriteria(params.targetScore);
  return prisma.review.create({
    data: {
      workId: params.workId,
      reviewerId: params.reviewerId,
      criteria,
      weights: Object.fromEntries(criteriaSeed.map((item) => [item.key, item.weight])),
      totalScore: calculateScore(criteria),
      comment: params.comment,
      isFinalized: params.finalized ?? true,
      isCommissionReview: params.isCommissionReview,
      createdAt: params.createdAt,
    },
  });
}

async function createStages(workId: string, status: WorkStatus, startDate: Date): Promise<void> {
  const stages = [
    ['Тема выбрана', WorkStatus.TOPIC_SELECTED],
    ['Тема утверждена', WorkStatus.APPROVED],
    ['Работа в процессе написания', WorkStatus.IN_PROGRESS],
    ['Финальная проверка', WorkStatus.REVIEW],
    ['Требуются доработки', WorkStatus.NEEDS_REVISION],
    ['Допущена к защите', WorkStatus.DEFENSE],
    ['Работа завершена', WorkStatus.PUBLISHED],
  ] as const;
  const order = [
    WorkStatus.DRAFT,
    WorkStatus.TOPIC_SELECTED,
    WorkStatus.APPROVED,
    WorkStatus.IN_PROGRESS,
    WorkStatus.REVIEW,
    WorkStatus.NEEDS_REVISION,
    WorkStatus.DEFENSE,
    WorkStatus.PUBLISHED,
  ];
  const current = order.indexOf(status);

  await prisma.workStage.createMany({
    data: stages.map(([name, stageStatus], index) => {
      const done = current >= order.indexOf(stageStatus);
      return {
        workId,
        name,
        deadline: addDays(startDate, 20 + index * 28),
        isCompleted: done,
        completedAt: done ? addDays(startDate, 8 + index * 24) : null,
        createdAt: addDays(startDate, index * 3),
      };
    }),
  });
}

async function main(): Promise<void> {
  await clearDatabase();

  const admin = await createUser({
    email: 'admin@diplom.local',
    fullName: 'Администратор Архива',
    role: Role.ADMIN,
    specialization: 'Администрирование платформы',
    bio: 'Отвечает за модерацию пользователей, публикацию материалов и качество данных в архиве.',
    createdAt: daysAgo(460),
  });

  const supervisors = await Promise.all(
    supervisorSeeds.map((item, index) =>
      createUser({
        ...item,
        role: Role.SUPERVISOR,
        createdAt: daysAgo(420 - index * 11),
      }),
    ),
  );

  const students = await Promise.all(
    studentSeeds.map(([email, fullName, group], index) =>
      createUser({
        email,
        fullName,
        group,
        role: Role.STUDENT,
        bio: 'Студент программы практической психологии. Ведет дипломный проект в электронном архиве и использует кабинет для коммуникации с преподавателем.',
        createdAt: daysAgo(260 - index * 7),
      }),
    ),
  );

  const graduates = await Promise.all(
    graduateSeeds.map(([email, fullName, group], index) =>
      createUser({
        email,
        fullName,
        group,
        role: Role.STUDENT,
        bio: 'Студент программы практической психологии. Работа опубликована в каталоге и используется как пример структуры исследования.',
        createdAt: daysAgo(720 - index * 35),
      }),
    ),
  );

  await createUser({
    email: 'guest.demo@diplom.local',
    fullName: 'Гость Демонстрационный',
    role: Role.GUEST,
    bio: 'Демонстрационный пользователь с гостевым доступом к публичному каталогу.',
    createdAt: daysAgo(14),
  });

  await createUser({
    email: 'blocked.user@diplom.local',
    fullName: 'Заблокированный Пользователь',
    role: Role.STUDENT,
    group: 'ПП-24',
    isBlocked: true,
    bio: 'Техническая запись для проверки административного сценария блокировки.',
    createdAt: daysAgo(50),
  });

  const userByEmail = new Map(
    [...supervisors, ...students, ...graduates, admin].map((user) => [user.email, user]),
  );

  await prisma.reviewCriteriaConfig.createMany({
    data: criteriaSeed.map((item, index) => ({
      name: item.name,
      description: item.description,
      weight: item.weight,
      maxScore: 10,
      isActive: true,
      orderIndex: index,
    })),
  });

  await prisma.infoPost.createMany({
    data: [
      {
        title: 'Открыт прием заявок на темы дипломных работ 2026 года',
        content:
          'Студенты выпускных групп могут выбрать тему из каталога преподавателей или предложить собственную. Рекомендуем приложить краткое обоснование, предполагаемую выборку и список методик.',
        isPinned: true,
        tags: ['диплом', 'темы', 'важно'],
        authorId: admin.id,
        createdAt: daysAgo(42),
      },
      {
        title: 'Обновлены критерии структурированного рецензирования',
        content:
          'В форму добавлены развернутые описания критериев и веса. Итоговая оценка рассчитывается автоматически, отдельно для рецензии преподавателя и внешних рецензентов.',
        isPinned: true,
        tags: ['рецензирование', 'оценка', 'методология'],
        authorId: admin.id,
        createdAt: daysAgo(30),
      },
      {
        title: 'Памятка по загрузке файлов защиты',
        content:
          'К работе можно прикрепить PDF, презентацию и видеозапись защиты. Названия файлов должны быть понятными: версия, дата и тип материала.',
        isPinned: false,
        tags: ['файлы', 'защита', 'инструкция'],
        authorId: admin.id,
        createdAt: daysAgo(18),
      },
      {
        title: 'В каталоге опубликованы лучшие работы прошлых лет',
        content:
          'В публичном каталоге появились дипломы 2022-2025 годов по семейной, клинической, организационной и цифровой психологии.',
        isPinned: false,
        tags: ['каталог', 'выпускники', 'публикация'],
        authorId: admin.id,
        createdAt: daysAgo(9),
      },
      {
        title: 'Как найти подходящие дипломные работы в каталоге',
        content:
          'Поиск в каталоге помогает быстро найти работы по теме, направлению, ключевым словам или фамилии преподавателя.\n\n1. Откройте раздел «Каталог работ». В строке поиска введите слово или фразу, которая ближе всего описывает вашу тему. Это может быть направление, например «семейная психология», проблема, например «тревожность», или фамилия автора/преподавателя.\n\n2. Начинайте с короткого запроса. Если написать слишком длинную фразу, часть полезных работ может не попасть в результаты. Лучше сначала ввести 1-2 главных слова, посмотреть выдачу, а потом уточнить запрос.\n\n3. Используйте фильтры. Если результатов слишком много, выберите год, категорию, преподавателя или минимальную оценку. Так проще оставить только те работы, которые действительно подходят для вашей задачи.\n\n4. Откройте карточку работы и посмотрите описание, аннотацию, теги, автора, преподавателя и прикрепленные материалы. Это поможет понять, насколько работа близка к вашей теме и можно ли использовать ее как пример структуры, методик или оформления.\n\n5. Сравните несколько работ. Не ограничивайтесь первой найденной карточкой: полезно открыть 3-5 похожих работ и отметить, какие темы, методы и формулировки встречаются чаще всего.\n\n6. Если ничего не нашлось, попробуйте синонимы или более общее слово. Например, вместо «страх публичного выступления» можно попробовать «тревожность», «самопрезентация» или «ораторское мастерство».\n\nКаталог нужен не для копирования чужой работы, а для ориентира: он помогает увидеть, какие темы уже изучались, как формулируются цели и задачи, какие методы используют студенты и какие материалы можно обсудить с преподавателем.',
        isPinned: false,
        tags: ['поиск', 'каталог', 'студентам', 'инструкция'],
        authorId: admin.id,
        createdAt: daysAgo(3),
      },
    ],
  });

  await prisma.faqItem.createMany({
    data: [
      {
        question: 'Как выбрать тему дипломной работы?',
        answer:
          'Откройте раздел «Темы», изучите предложения преподавателей и отправьте отклик на подходящую тему. Если у вас есть собственная идея, опишите цель, предполагаемую выборку и методики в сообщении преподавателю.',
        orderIndex: 0,
        isActive: true,
        authorId: admin.id,
      },
      {
        question: 'Кто видит загруженные файлы работы?',
        answer:
          'Черновики доступны автору и назначенному преподавателю. Опубликованные работы появляются в каталоге после завершения проверки и открытия публичного доступа.',
        orderIndex: 1,
        isActive: true,
        authorId: admin.id,
      },
      {
        question: 'Можно ли заменить файл после загрузки?',
        answer:
          'Да. Загрузите новую версию в рабочем пространстве диплома. Система сохранит историю версий, а преподаватель сможет сравнить изменения.',
        orderIndex: 2,
        isActive: true,
        authorId: admin.id,
      },
      {
        question: 'Что делать, если преподаватель задал уточняющий вопрос?',
        answer:
          'Ответьте в переписке по теме или в рабочем пространстве диплома. После согласования тема или следующий этап работы будут обновлены в личном кабинете.',
        orderIndex: 3,
        isActive: true,
        authorId: admin.id,
      },
      {
        question: 'Как найти подходящие дипломные работы в каталоге?',
        answer:
          'Откройте раздел «Каталог работ» и введите в строку поиска тему, направление, ключевое слово или фамилию преподавателя. Лучше начинать с короткого запроса: например, «тревожность», «семейная психология» или «самооценка». Если результатов слишком много, используйте фильтры по году, категории, преподавателю или оценке. Откройте несколько карточек работ и сравните описание, аннотацию, теги, автора, преподавателя и прикрепленные материалы. Если нужные работы не находятся, попробуйте более общее слово или синоним. Каталог нужен не для копирования чужой работы, а как ориентир: он помогает понять, какие темы уже изучались, какие методы использовали студенты и какие примеры можно обсудить с преподавателем.',
        orderIndex: 4,
        isActive: true,
        authorId: admin.id,
      },
    ],
  });

  const topicRecords = await Promise.all(
    [
      ['elena.morozova@diplom.local', 'Эмоциональная близость в молодых семьях', 'Исследование факторов поддержки, конфликтности и удовлетворенности отношениями.', 'Семейная психология'],
      ['andrey.sokolov@diplom.local', 'Психологическая адаптация сотрудников в гибридных командах', 'Работа на стыке организационной психологии, HR-аналитики и дизайна командной коммуникации.', 'Организационная психология'],
      ['irina.petrova@diplom.local', 'Тревожные состояния у студентов в период адаптации', 'Эмпирическое исследование с психодиагностикой и рекомендациями для службы поддержки студентов.', 'Клиническая психология'],
      ['mikhail.volkov@diplom.local', 'Когнитивные искажения и повседневная саморегуляция', 'Проект с опорой на КПТ-подход и анализ дневниковых данных.', 'Когнитивная психология'],
      ['natalia.lebedeva@diplom.local', 'Психологическая безопасность школьной среды', 'Исследование климата класса, мотивации и тревожности подростков.', 'Психология образования'],
      ['roman.kuznetsov@diplom.local', 'Этика и доверие в онлайн-консультировании', 'Проект о цифровой психологической помощи, пользовательском доверии и границах ответственности.', 'Цифровая психология'],
      ['olga.fedorova@diplom.local', 'Арт-терапия как ресурс эмоциональной саморегуляции', 'Прикладное исследование творческих методов помощи подросткам и взрослым.', 'Арт-терапия'],
      ['sergey.orlov@diplom.local', 'Психометрика коротких опросников в прикладных исследованиях', 'Методологическая работа с валидизацией шкал и проверкой надежности.', 'Психометрика'],
      ['elena.morozova@diplom.local', 'Родительское выгорание и способы психологической поддержки', 'Тема для студентов, интересующихся семейным консультированием.', 'Семейная психология'],
      ['roman.kuznetsov@diplom.local', 'Пользовательский опыт сервисов психологической самопомощи', 'Исследование факторов удержания и доверия в мобильных продуктах.', 'Цифровая психология'],
    ].map(([email, title, description, area], index) => {
      const supervisor = userByEmail.get(email)!;
      return prisma.supervisorTopic.create({
        data: {
          title,
          description,
          area,
          isActive: index !== 8,
          supervisorId: supervisor.id,
          createdAt: daysAgo(70 - index * 4),
        },
      });
    }),
  );

  const responses = await Promise.all(
    students.slice(0, 12).map((student, index) =>
      prisma.topicResponse.create({
        data: {
          studentId: student.id,
          topicId: topicRecords[index % topicRecords.length].id,
          message:
            index % 3 === 0
              ? 'Хочу взять тему, потому что уже собирала первичные материалы и вижу практическую ценность исследования.'
              : 'Тема близка моему профессиональному интересу. Готов(а) уточнить выборку и методики на первой консультации.',
          status:
            index < 7
              ? TopicResponseStatus.ACCEPTED
              : index < 10
                ? TopicResponseStatus.PENDING
                : TopicResponseStatus.REJECTED,
          createdAt: daysAgo(55 - index * 3),
        },
      }),
    ),
  );

  await prisma.topicResponseMessage.createMany({
    data: responses.flatMap((response, index) => [
      {
        responseId: response.id,
        authorId: response.studentId,
        text: 'Здравствуйте! Прикладываю краткое обоснование интереса к теме и предварительную идею выборки.',
        createdAt: daysAgo(54 - index * 3),
      },
      {
        responseId: response.id,
        authorId: topicRecords[index % topicRecords.length].supervisorId,
        text:
          response.status === TopicResponseStatus.REJECTED
            ? 'Спасибо за отклик. Сейчас по этой теме уже набрана группа, предлагаю выбрать соседнее направление.'
            : 'Спасибо, идея подходит. На встрече обсудим формулировку гипотезы и реалистичный план сбора данных.',
        createdAt: daysAgo(53 - index * 3),
      },
    ]),
  });

  await prisma.studentPortfolioItem.createMany({
    data: [...students, ...graduates].flatMap((student, index) => [
      {
        studentId: student.id,
        title: index % 2 === 0 ? 'Курсовая работа по психодиагностике' : 'Исследовательский мини-проект',
        type: PortfolioItemType.COURSEWORK,
        description:
          index % 2 === 0
            ? 'Анализ диагностического инструментария и интерпретация результатов пилотной выборки.'
            : 'Небольшое эмпирическое исследование с анкетированием и тематическим анализом ответов.',
        year: 2024 + (index % 2),
        grade: index % 4 === 0 ? 'отлично' : 'хорошо',
        fileUrl: `/uploads/portfolio/${slug(student.fullName)}-coursework.pdf`,
        createdAt: daysAgo(190 - index * 2),
      },
      {
        studentId: student.id,
        title: 'Практический кейс консультирования',
        type: PortfolioItemType.PERSONAL_PROJECT,
        description:
          'Анонимизированный учебный кейс с описанием запроса, плана работы и рефлексией по итогам супервизии.',
        year: 2025,
        grade: null,
        fileUrl: `/uploads/portfolio/${slug(student.fullName)}-case.pdf`,
        createdAt: daysAgo(120 - index),
      },
    ]),
  });

  await prisma.topicRequest.createMany({
    data: workSeeds.slice(0, 12).map((item, index) => ({
      proposedTopic: item.title,
      justification:
        index % 4 === 0
          ? 'Тема выбрана после консультации с преподавателем и связана с уже собранными первичными наблюдениями.'
          : 'Тема соответствует профессиональному интересу студента и может быть реализована в рамках дипломного исследования.',
      rejectReason:
        index === 10
          ? 'Необходимо сузить предмет исследования и уточнить диагностические методики.'
          : null,
      status:
        index === 10
          ? TopicRequestStatus.REJECTED
          : index === 11
            ? TopicRequestStatus.PENDING
            : TopicRequestStatus.APPROVED,
      studentId: userByEmail.get(item.student)!.id,
      supervisorId: userByEmail.get(item.supervisor)!.id,
      createdAt: daysAgo(95 - index * 5),
    })),
  });

  const works = [];
  for (let index = 0; index < workSeeds.length; index += 1) {
    const item = workSeeds[index];
    const author = userByEmail.get(item.student)!;
    const supervisor = userByEmail.get(item.supervisor)!;
    const createdAt = daysAgo(item.status === WorkStatus.PUBLISHED ? 420 - index * 12 : 130 - index * 5);
    const work = await prisma.work.create({
      data: {
        title: item.title,
        description: `Дипломная работа по направлению «${item.category}». В проекте описаны теоретическая база, эмпирическая часть, выводы и практические рекомендации для специалистов.`,
        annotation: `Исследование посвящено теме «${item.title}». Работа включает обзор литературы, постановку гипотезы, описание выборки, анализ данных и рекомендации для практики.`,
        fullText: `Полный текст работы «${item.title}» содержит введение, две теоретические главы, эмпирическое исследование, заключение, список литературы и приложения с методиками.`,
        category: item.category,
        tags: item.tags,
        status: item.status,
        year: item.year,
        viewCount: item.views,
        isPublic: item.status === WorkStatus.PUBLISHED,
        authorId: author.id,
        supervisorId: supervisor.id,
        createdAt,
      },
    });
    works.push({ ...item, record: work });

    await createStages(work.id, item.status, createdAt);

    if (item.status !== WorkStatus.DRAFT && item.status !== WorkStatus.TOPIC_SELECTED) {
      await prisma.file.createMany({
        data: [
          {
            workId: work.id,
            filename: `${slug(item.title)}-v1.pdf`,
            originalName: `${item.title}.pdf`,
            mimeType: 'application/pdf',
            size: 2_400_000 + index * 37_000,
            type: FileType.PDF,
            url: `/uploads/works/${work.id}/${slug(item.title)}.pdf`,
            version: 1,
            comment: 'Основной текст дипломной работы.',
            textContent: `Извлеченный текст PDF: ${item.title}. Аннотация, цель, задачи, гипотеза, методы, результаты и выводы.`,
            createdAt: addDays(createdAt, 45),
          },
          {
            workId: work.id,
            filename: `${slug(item.title)}-presentation.pptx`,
            originalName: `Презентация - ${item.title}.pptx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            size: 6_800_000 + index * 52_000,
            type: FileType.PRESENTATION,
            url: `/uploads/works/${work.id}/${slug(item.title)}-presentation.pptx`,
            version: 1,
            comment: 'Презентация для предзащиты и защиты.',
            textContent: 'Слайды: актуальность, цель, гипотеза, методики, результаты, выводы, рекомендации.',
            createdAt: addDays(createdAt, 70),
          },
          ...(item.status === WorkStatus.PUBLISHED
            ? [
                {
                  workId: work.id,
                  filename: `${slug(item.title)}-defense.mp4`,
                  originalName: `Видео защиты - ${item.title}.mp4`,
                  mimeType: 'video/mp4',
                  size: 188_000_000 + index * 1_250_000,
                  type: FileType.VIDEO,
                  url: `/uploads/works/${work.id}/${slug(item.title)}-defense.mp4`,
                  version: 1,
                  comment: 'Запись итоговой защиты.',
                  textContent: null,
                  createdAt: addDays(createdAt, 92),
                },
              ]
            : []),
        ],
      });
    }

    if (item.score !== null) {
      const externalReviewer = supervisors[(supervisors.indexOf(supervisor) + 3 + index) % supervisors.length];
      const commissionReview = await createReview({
        workId: work.id,
        reviewerId: supervisor.id,
        targetScore: item.score,
        isCommissionReview: true,
        createdAt: addDays(createdAt, 78),
        comment:
          item.score >= 88
            ? 'Работа выполнена на высоком уровне: тема раскрыта, методология обоснована, выводы хорошо связаны с практическими рекомендациями.'
            : 'Работа в целом соответствует требованиям, однако отдельные разделы требуют более аккуратной аргументации и уточнения выводов.',
      });
      const externalReview = await createReview({
        workId: work.id,
        reviewerId: externalReviewer.id,
        targetScore: Math.max(62, item.score - 4 + (index % 5)),
        isCommissionReview: false,
        createdAt: addDays(createdAt, 82),
        finalized: item.status !== WorkStatus.REVIEW || index % 2 === 0,
        comment:
          'Рецензент отмечает практическую значимость исследования, корректную структуру работы и рекомендует доработать формулировки части выводов перед публикацией.',
      });

      await prisma.work.update({
        where: { id: work.id },
        data: {
          commissionReviewScore: commissionReview.totalScore,
          externalReviewScore: externalReview.totalScore,
        },
      });
    }

    const commenters = [author, supervisor, admin];
    await prisma.comment.createMany({
      data: commenters.map((commenter, commentIndex) => ({
        workId: work.id,
        authorId: commenter.id,
        text:
          commentIndex === 0
            ? 'Добавила актуальную версию материалов и буду благодарна за замечания по структуре эмпирической части.'
            : commentIndex === 1
              ? 'Посмотрел(а) материалы. Следующий фокус - уточнить выводы и привести описание выборки к единому формату.'
              : 'Карточка заполнена корректно, файлы и статусы отображаются в архиве.',
        createdAt: addDays(createdAt, 50 + commentIndex * 8),
      })),
    });

    await prisma.workMessage.createMany({
      data: [
        {
          workId: work.id,
          authorId: author.id,
          text: 'Добрый день! Загрузил(а) новую версию работы, отдельно выделила раздел с методиками.',
          createdAt: addDays(createdAt, 52),
        },
        {
          workId: work.id,
          authorId: supervisor.id,
          text: 'Спасибо, посмотрю до пятницы. Обратите внимание на связь гипотезы и выбранных шкал.',
          createdAt: addDays(createdAt, 53),
        },
        {
          workId: work.id,
          authorId: author.id,
          text: 'Принято, дополню обоснование и обновлю список литературы.',
          createdAt: addDays(createdAt, 54),
        },
      ],
    });
  }

  await prisma.notification.createMany({
    data: works.flatMap((item, index) => {
      const author = userByEmail.get(item.student)!;
      const supervisor = userByEmail.get(item.supervisor)!;
      return [
        {
          userId: author.id,
          type: 'WORK_STATUS_CHANGED',
          title: 'Статус работы обновлен',
          message: `Работа «${item.title}» находится в статусе «${item.status}».`,
          isRead: index % 3 === 0,
          data: { workId: item.record.id, status: item.status },
          createdAt: daysAgo(24 - (index % 12)),
        },
        {
          userId: supervisor.id,
          type: 'WORK_ACTIVITY',
          title: 'Активность по работе студента',
          message: `${author.fullName} обновил(а) материалы по работе «${item.title}».`,
          isRead: index % 2 === 0,
          data: { workId: item.record.id, studentId: author.id },
          createdAt: daysAgo(20 - (index % 10)),
        },
      ];
    }),
  });

  const counts = {
    users: await prisma.user.count(),
    works: await prisma.work.count(),
    files: await prisma.file.count(),
    reviews: await prisma.review.count(),
    comments: await prisma.comment.count(),
    stages: await prisma.workStage.count(),
    notifications: await prisma.notification.count(),
    topics: await prisma.supervisorTopic.count(),
    topicResponses: await prisma.topicResponse.count(),
    portfolioItems: await prisma.studentPortfolioItem.count(),
    infoPosts: await prisma.infoPost.count(),
  };

  console.log('Database was fully reset and populated.');
  console.log(`Default password for seeded accounts: ${PASSWORD}`);
  console.table(counts);
  console.log('Useful logins:');
  console.log('  admin@diplom.local');
  console.log('  elena.morozova@diplom.local');
  console.log('  anna.ivanova@diplom.local');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
