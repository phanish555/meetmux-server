const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding placemux…');

  // Skills first (referenced by both students and jobs)
  const skillNames = [
    'Node.js', 'Express', 'PostgreSQL', 'React', 'TypeScript',
    'Python', 'Go', 'Kubernetes', 'GraphQL', 'Embedded C', 'SQL',
  ];
  await prisma.skill.createMany({
    data: skillNames.map((name) => ({ name })),
    skipDuplicates: true,
  });
  const skills = await prisma.skill.findMany();
  const skillId = (n) => skills.find((s) => s.name === n).id;

  // Companies — upsert makes the seed idempotent
  const nimbus = await prisma.company.upsert({
    where: { uq_company_name_city: { name: 'Nimbus Analytics', city: 'Bengaluru' } },
    update: {},
    create: {
      name: 'Nimbus Analytics', industry: 'Data & Analytics', city: 'Bengaluru',
      employeeCount: 450, verified: true,
    },
  });
  const kaveri = await prisma.company.upsert({
    where: { uq_company_name_city: { name: 'Kaveri Fintech', city: 'Hyderabad' } },
    update: {},
    create: {
      name: 'Kaveri Fintech', industry: 'Financial Services', city: 'Hyderabad',
      employeeCount: 1200, verified: true,
    },
  });
  const orbital = await prisma.company.upsert({
    where: { uq_company_name_city: { name: 'Orbital Logistics', city: 'Pune' } },
    update: {},
    create: {
      name: 'Orbital Logistics', industry: 'Supply Chain', city: 'Pune',
      employeeCount: 230, verified: false,
    },
  });

  // Jobs
  const findOrCreateJob = async (data, skillsForJob) => {
    const existing = await prisma.job.findFirst({
      where: { companyId: data.companyId, title: data.title, city: data.city },
    });
    if (existing) return existing;
    return prisma.job.create({
      data: {
        ...data,
        jobSkills: {
          create: skillsForJob.map((n) => ({ skillId: skillId(n), required: true })),
        },
      },
    });
  };

  const backendIntern = await findOrCreateJob({
    companyId: nimbus.id, title: 'Backend Engineer Intern', city: 'Bengaluru',
    type: 'INTERNSHIP', stipendPaise: 3_500_000, openings: 3,
    deadline: new Date('2027-08-15'),
  }, ['Node.js', 'Express', 'SQL']);

  const platform = await findOrCreateJob({
    companyId: kaveri.id, title: 'Junior Platform Engineer', city: 'Hyderabad',
    type: 'FULL_TIME', stipendPaise: null, openings: 2,
    deadline: new Date('2027-09-01'),
  }, ['Go', 'Kubernetes']);

  const frontendIntern = await findOrCreateJob({
    companyId: nimbus.id, title: 'Frontend Intern', city: 'Remote',
    type: 'INTERNSHIP', stipendPaise: 2_800_000, openings: 5,
    deadline: new Date('2027-08-30'),
  }, ['React', 'TypeScript']);

  // Students
  const upsertStudent = (data, studentSkillsList) =>
    prisma.student.upsert({
      where: { email: data.email },
      update: {},
      create: {
        ...data,
        studentSkills: {
          create: studentSkillsList.map(({ name, level }) => ({ skillId: skillId(name), level })),
        },
      },
    });

  const aarav = await upsertStudent(
    { name: 'Aarav Sharma', email: 'aarav.sharma@example.edu', branch: 'Computer Science', graduationYear: 2026, cgpa: 8.4, status: 'SEEKING' },
    [{ name: 'Node.js', level: 4 }, { name: 'Express', level: 3 }, { name: 'PostgreSQL', level: 3 }],
  );
  const diya = await upsertStudent(
    { name: 'Diya Nair', email: 'diya.nair@example.edu', branch: 'Information Technology', graduationYear: 2026, cgpa: 9.1, status: 'PLACED' },
    [{ name: 'React', level: 5 }, { name: 'TypeScript', level: 4 }, { name: 'GraphQL', level: 3 }],
  );
  await upsertStudent(
    { name: 'Rohan Iyer', email: 'rohan.iyer@example.edu', branch: 'Electronics', graduationYear: 2027, cgpa: 7.6, status: 'SEEKING' },
    [{ name: 'Python', level: 3 }, { name: 'Embedded C', level: 4 }],
  );

  // Applications + initial audit event, in a transaction
  const upsertApplication = async (studentId, jobId, status) => {
    const existing = await prisma.application.findUnique({
      where: { uq_application_student_job: { studentId, jobId } },
    });
    if (existing) return existing;
    return prisma.$transaction(async (tx) => {
      const app = await tx.application.create({ data: { studentId, jobId, status } });
      await tx.applicationEvent.create({
        data: { applicationId: app.id, fromStatus: null, toStatus: status },
      });
      return app;
    });
  };

  const app1 = await upsertApplication(aarav.id, backendIntern.id, 'UNDER_REVIEW');
  const app2 = await upsertApplication(diya.id, frontendIntern.id, 'SHORTLISTED');

  // Interviews for app1
  await prisma.interview.upsert({
    where: { uq_interview_application_round: { applicationId: app1.id, round: 1 } },
    update: {},
    create: {
      applicationId: app1.id, round: 1,
      scheduledAt: new Date('2026-07-05T09:00:00Z'), outcome: 'PASSED',
    },
  });
  await prisma.interview.upsert({
    where: { uq_interview_application_round: { applicationId: app1.id, round: 2 } },
    update: {},
    create: {
      applicationId: app1.id, round: 2,
      scheduledAt: new Date('2026-07-15T09:00:00Z'), outcome: 'PENDING',
    },
  });
  await prisma.interview.upsert({
    where: { uq_interview_application_round: { applicationId: app2.id, round: 1 } },
    update: {},
    create: {
      applicationId: app2.id, round: 1,
      scheduledAt: new Date('2026-07-08T11:30:00Z'), outcome: 'PASSED',
    },
  });

  const counts = {
    skills: await prisma.skill.count(),
    companies: await prisma.company.count(),
    jobs: await prisma.job.count(),
    students: await prisma.student.count(),
    applications: await prisma.application.count(),
    interviews: await prisma.interview.count(),
    events: await prisma.applicationEvent.count(),
  };
  console.log('Seed complete:', counts);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
