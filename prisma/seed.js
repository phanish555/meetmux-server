// Realistic seed for Task 8 — deliberately includes the awkward shapes
// (students with 0 apps, empty companies, power applicants, placed students)
// because a uniform seed hides relationship bugs.
//
// Idempotent: every write is upsert-guarded so `db:seed` can run twice
// and produce no duplicates.

const { PrismaClient } = require('@prisma/client');
const { faker, personName, cgpa, BRANCHES, CITIES, INDUSTRIES } = require('./seed-src/helpers');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding placemux…');

  // 1. Skills — parents first (FKs demand it)
  const skillNames = [
    'Node.js', 'Express', 'PostgreSQL', 'React', 'TypeScript',
    'Python', 'Go', 'Kubernetes', 'GraphQL', 'Embedded C', 'SQL',
    'Docker', 'Redis', 'AWS',
  ];
  await prisma.skill.createMany({
    data: skillNames.map((name) => ({ name })),
    skipDuplicates: true,
  });
  const skills = await prisma.skill.findMany();
  const pickSkills = (n) => faker.helpers.arrayElements(skills, n);

  // 2. Companies — deliberately include one with ZERO jobs
  const companies = [];
  for (let i = 0; i < 6; i += 1) {
    const name = faker.company.name() + ' ' + faker.string.alpha({ length: 3, casing: 'upper' });
    const city = faker.helpers.arrayElement(CITIES);
    const company = await prisma.company.upsert({
      where: { uq_company_name_city: { name, city } },
      update: {},
      create: {
        name,
        industry: faker.helpers.arrayElement(INDUSTRIES),
        city,
        employeeCount: faker.number.int({ min: 30, max: 5000 }),
        verified: faker.datatype.boolean({ probability: 0.7 }),
        createdAt: faker.date.past({ years: 1 }),
      },
    });
    companies.push(company);
  }
  const emptyCompany = companies[companies.length - 1]; // gets zero jobs on purpose

  // 3. Jobs — skip the empty company
  const jobs = [];
  for (const company of companies.slice(0, -1)) {
    const jobCount = faker.number.int({ min: 1, max: 3 });
    for (let j = 0; j < jobCount; j += 1) {
      const title = faker.person.jobTitle();
      const existing = await prisma.job.findFirst({
        where: { companyId: company.id, title },
      });
      if (existing) { jobs.push(existing); continue; }

      const job = await prisma.job.create({
        data: {
          companyId: company.id,
          title,
          city: faker.helpers.arrayElement(CITIES),
          type: faker.helpers.arrayElement(['INTERNSHIP', 'FULL_TIME']),
          stipendPaise: faker.number.int({ min: 1_500_000, max: 8_000_000 }),
          openings: faker.number.int({ min: 1, max: 5 }),
          deadline: faker.date.future({ years: 1 }),
          createdAt: faker.date.recent({ days: 90 }),
          jobSkills: {
            create: pickSkills(faker.number.int({ min: 2, max: 5 }))
              .map((s) => ({ skillId: s.id, required: faker.datatype.boolean() })),
          },
        },
      });
      jobs.push(job);
    }
  }

  // 4. Students — mix of shapes: some with 0 apps, one power applicant
  const students = [];
  for (let i = 0; i < 15; i += 1) {
    const name = personName();
    const email = `${name.toLowerCase().replace(' ', '.')}${i}@example.edu`;
    const student = await prisma.student.upsert({
      where: { email },
      update: {},
      create: {
        name,
        email,
        branch: faker.helpers.arrayElement(BRANCHES),
        graduationYear: faker.helpers.arrayElement([2026, 2026, 2027]),
        cgpa: cgpa(),
        createdAt: faker.date.past({ years: 1 }),
        studentSkills: {
          create: pickSkills(faker.number.int({ min: 1, max: 6 }))
            .map((s) => ({ skillId: s.id, level: faker.number.int({ min: 1, max: 5 }) })),
        },
      },
    });
    students.push(student);
  }

  // 5. Applications — deliberately uneven distribution
  const STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'REJECTED', 'OFFERED', 'WITHDRAWN'];
  const seen = new Set();

  for (const [idx, student] of students.entries()) {
    // First two students get ZERO applications on purpose
    if (idx < 2) continue;
    // One "power applicant" hits many jobs
    const appCount = idx === 2 ? Math.min(10, jobs.length)
                               : faker.number.int({ min: 1, max: 4 });

    const targets = faker.helpers.arrayElements(jobs, appCount);
    for (const job of targets) {
      const key = `${student.id}:${job.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const existing = await prisma.application.findUnique({
        where: { uq_application_student_job: { studentId: student.id, jobId: job.id } },
      });
      if (existing) continue;

      const status = faker.helpers.arrayElement(STATUSES);
      const appliedAt = faker.date.recent({ days: 60 });

      await prisma.$transaction(async (tx) => {
        const app = await tx.application.create({
          data: {
            studentId: student.id, jobId: job.id, status,
            appliedAt, updatedAt: appliedAt,
            withdrawnAt: status === 'WITHDRAWN' ? faker.date.recent({ days: 10 }) : null,
          },
        });
        await tx.applicationEvent.create({
          data: {
            applicationId: app.id, fromStatus: null,
            toStatus: 'SUBMITTED', createdAt: appliedAt,
          },
        });
      });
    }
  }

  // 6. Placement — one fully-placed student, exercising the 1:1 path
  const offered = await prisma.application.findFirst({
    where: { status: 'OFFERED', placement: null },
  });
  if (offered) {
    const job = await prisma.job.findUnique({ where: { id: offered.jobId } });
    await prisma.$transaction(async (tx) => {
      await tx.placement.create({
        data: {
          studentId: offered.studentId,
          jobId: offered.jobId,
          applicationId: offered.id,
          offeredCtcPaise: BigInt(job.stipendPaise || 3_500_000) * 12n,
          titleAtOffer: job.title,
        },
      });
      await tx.student.update({
        where: { id: offered.studentId },
        data: { status: 'PLACED' },
      });
    });
  }

  await printSummary();
}

async function printSummary() {
  const [companies, jobs, students, apps, placements, interviews, events] = await Promise.all([
    prisma.company.count(),
    prisma.job.count(),
    prisma.student.count(),
    prisma.application.count(),
    prisma.placement.count(),
    prisma.interview.count(),
    prisma.applicationEvent.count(),
  ]);

  const studentsNoApps = await prisma.student.count({
    where: { applications: { none: {} } },
  });
  const jobsNoApps = await prisma.job.count({
    where: { applications: { none: {} } },
  });
  const companiesNoJobs = await prisma.company.count({
    where: { jobs: { none: {} } },
  });
  const powerApplicants = await prisma.student.count({
    where: { applications: { some: {} } },
  });
  const maxAppsAgg = await prisma.application.groupBy({
    by: ['studentId'], _count: { _all: true },
    orderBy: { _count: { studentId: 'desc' } }, take: 1,
  });
  const maxApps = maxAppsAgg[0]?._count._all ?? 0;

  console.log(`
━━ Seed summary ━━━━━━━━━━━━━━━━━━━━━━━━━━
  Companies:        ${companies}  (${companiesNoJobs} with no jobs)
  Jobs:             ${jobs}       (${jobsNoApps} with no applications)
  Students:         ${students}   (${studentsNoApps} with no applications)
  Applications:     ${apps}       (max per student: ${maxApps})
  Applicants:       ${powerApplicants}
  Interviews:       ${interviews}
  Events:           ${events}
  Placements:       ${placements}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
