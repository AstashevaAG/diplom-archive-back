import { PortfolioItemType, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PASSWORD = 'Psy2026!demo';

const admin = {
  email: 'admin@diplom.local',
  fullName: 'Администратор Архива',
  specialization: 'Администрирование платформы',
  bio: 'Управляет пользователями, проверяет публикации и поддерживает актуальность справочников дипломного архива.',
};

const supervisors = [
  {
    email: 'money.teacher@diplom.local',
    fullName: 'Васильева Марина Андреевна',
    specialization: 'Деньги',
    bio: 'Практический психолог, специализируется на финансовом поведении, денежных установках, тревоге вокруг дохода и психологических барьерах в профессиональном росте.',
    topicTitle: 'Денежные установки и финансовая тревожность у молодых специалистов',
    topicDescription:
      'Исследование связи семейных сценариев о деньгах, самооценки профессиональной ценности и уровня финансовой тревожности у молодых специалистов.',
  },
  {
    email: 'children.teacher@diplom.local',
    fullName: 'Громова Ольга Сергеевна',
    specialization: 'Дети',
    bio: 'Детский и семейный психолог. Работает с эмоциональной регуляцией детей, адаптацией к школе и поддержкой родителей в кризисные периоды.',
    topicTitle: 'Развитие эмоциональной саморегуляции у детей младшего школьного возраста',
    topicDescription:
      'Практико-ориентированное исследование методов поддержки эмоциональной устойчивости детей через игровые и семейные упражнения.',
  },
  {
    email: 'health.rest.teacher@diplom.local',
    fullName: 'Крылов Денис Павлович',
    specialization: 'Здоровье, отдых',
    bio: 'Психолог-консультант по вопросам стресса, восстановления и профилактики эмоционального выгорания. Использует методы психообразования и поведенческого планирования отдыха.',
    topicTitle: 'Психологические факторы восстановления после эмоционального выгорания',
    topicDescription:
      'Анализ привычек отдыха, телесной осознанности и границ нагрузки как факторов восстановления у взрослых клиентов.',
  },
  {
    email: 'relationships.teacher@diplom.local',
    fullName: 'Романова Елена Викторовна',
    specialization: 'Отношения',
    bio: 'Семейный психолог, работает с привязанностью, коммуникацией в паре, конфликтами и построением безопасного диалога между партнерами.',
    topicTitle: 'Стили привязанности и способы разрешения конфликтов в паре',
    topicDescription:
      'Исследование того, как стиль привязанности влияет на коммуникацию, эмоциональную близость и выбор стратегий поведения в конфликте.',
  },
  {
    email: 'timemanagement.teacher@diplom.local',
    fullName: 'Лазарев Михаил Игоревич',
    specialization: 'Тайм-менеджмент',
    bio: 'Практический психолог и коуч по саморегуляции. Специализируется на прокрастинации, планировании, устойчивой мотивации и работе с перегрузкой.',
    topicTitle: 'Прокрастинация и навыки тайм-менеджмента у студентов-психологов',
    topicDescription:
      'Изучение связи когнитивных установок, уровня стресса и навыков планирования с прокрастинацией в учебных проектах.',
  },
];

const students = [
  ['student01@diplom.local', 'Алексеева Анна Дмитриевна', 'ПП-41', 'Финансовые установки и личные границы'],
  ['student02@diplom.local', 'Баранова Мария Олеговна', 'ПП-41', 'Психология детско-родительского общения'],
  ['student03@diplom.local', 'Волков Никита Сергеевич', 'ПП-41', 'Профилактика стресса и восстановление'],
  ['student04@diplom.local', 'Демидова Ксения Павловна', 'ПП-42', 'Коммуникация в близких отношениях'],
  ['student05@diplom.local', 'Ефимов Кирилл Андреевич', 'ПП-42', 'Прокрастинация и учебная мотивация'],
  ['student06@diplom.local', 'Зайцева Полина Ильинична', 'ПП-42', 'Психология продвижения экспертных услуг'],
  ['student07@diplom.local', 'Ильин Артем Максимович', 'ПП-43', 'Лидерство и командное взаимодействие'],
  ['student08@diplom.local', 'Козлова Дарья Романовна', 'ПП-43', 'Ораторское мастерство и уверенность'],
  ['student09@diplom.local', 'Лебедев Егор Денисович', 'ПП-43', 'Практические инструменты психолога'],
  ['student10@diplom.local', 'Миронова Софья Алексеевна', 'ПП-44', 'Психология работы и карьерного выбора'],
] as const;

function avatarName(fullName: string): string {
  return fullName
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: admin.email },
    create: {
      ...admin,
      passwordHash,
      role: Role.ADMIN,
      avatarUrl: `/avatars/${avatarName(admin.fullName)}.jpg`,
      isApproved: true,
    },
    update: {
      ...admin,
      passwordHash,
      role: Role.ADMIN,
      avatarUrl: `/avatars/${avatarName(admin.fullName)}.jpg`,
      isApproved: true,
      isBlocked: false,
      failedLogins: 0,
      blockedUntil: null,
    },
  });

  for (const supervisor of supervisors) {
    const user = await prisma.user.upsert({
      where: { email: supervisor.email },
      create: {
        email: supervisor.email,
        passwordHash,
        fullName: supervisor.fullName,
        role: Role.SUPERVISOR,
        specialization: supervisor.specialization,
        bio: supervisor.bio,
        avatarUrl: `/avatars/${avatarName(supervisor.fullName)}.jpg`,
        isApproved: true,
      },
      update: {
        passwordHash,
        fullName: supervisor.fullName,
        role: Role.SUPERVISOR,
        specialization: supervisor.specialization,
        bio: supervisor.bio,
        avatarUrl: `/avatars/${avatarName(supervisor.fullName)}.jpg`,
        isApproved: true,
        isBlocked: false,
        failedLogins: 0,
        blockedUntil: null,
      },
    });

    const existingTopic = await prisma.supervisorTopic.findFirst({
      where: { supervisorId: user.id, title: supervisor.topicTitle },
    });

    if (existingTopic) {
      await prisma.supervisorTopic.update({
        where: { id: existingTopic.id },
        data: {
          description: supervisor.topicDescription,
          area: supervisor.specialization,
          isActive: true,
        },
      });
    } else {
      await prisma.supervisorTopic.create({
        data: {
          supervisorId: user.id,
          title: supervisor.topicTitle,
          description: supervisor.topicDescription,
          area: supervisor.specialization,
          isActive: true,
        },
      });
    }
  }

  for (const [email, fullName, group, interest] of students) {
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        fullName,
        role: Role.STUDENT,
        group,
        specialization: interest,
        bio: `Студент программы практической психологии. Интересуется направлением: ${interest}. Использует кабинет для выбора темы, коммуникации с преподавателем и ведения дипломного проекта.`,
        avatarUrl: `/avatars/${avatarName(fullName)}.jpg`,
        isApproved: true,
      },
      update: {
        passwordHash,
        fullName,
        role: Role.STUDENT,
        group,
        specialization: interest,
        bio: `Студент программы практической психологии. Интересуется направлением: ${interest}. Использует кабинет для выбора темы, коммуникации с преподавателем и ведения дипломного проекта.`,
        avatarUrl: `/avatars/${avatarName(fullName)}.jpg`,
        isApproved: true,
        isBlocked: false,
        failedLogins: 0,
        blockedUntil: null,
      },
    });

    const existingPortfolioItem = await prisma.studentPortfolioItem.findFirst({
      where: { studentId: user.id, title: `Учебный проект: ${interest}` },
    });

    if (existingPortfolioItem) {
      await prisma.studentPortfolioItem.update({
        where: { id: existingPortfolioItem.id },
        data: {
          type: PortfolioItemType.PERSONAL_PROJECT,
          description: `Мини-исследование и практическая подборка материалов по направлению "${interest}".`,
          year: 2026,
          grade: 'зачтено',
        },
      });
    } else {
      await prisma.studentPortfolioItem.create({
        data: {
          studentId: user.id,
          title: `Учебный проект: ${interest}`,
          type: PortfolioItemType.PERSONAL_PROJECT,
          description: `Мини-исследование и практическая подборка материалов по направлению "${interest}".`,
          year: 2026,
          grade: 'зачтено',
        },
      });
    }
  }

  const [supervisorCount, studentCount, topicCount] = await Promise.all([
    prisma.user.count({ where: { email: { in: supervisors.map((item) => item.email) } } }),
    prisma.user.count({ where: { email: { in: students.map(([email]) => email) } } }),
    prisma.supervisorTopic.count({
      where: { title: { in: supervisors.map((item) => item.topicTitle) } },
    }),
  ]);

  console.log(`Created/updated supervisors: ${supervisorCount}`);
  console.log(`Created/updated students: ${studentCount}`);
  console.log(`Created/updated supervisor topics: ${topicCount}`);
  console.log(`Password for all accounts in this seed: ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
