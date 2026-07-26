// The definition of "no N+1" as an assertion: query count does not grow
// with row count. If someone refactors a service into a per-row loop,
// this fails immediately.

const prisma = require('../src/shared/prisma');
const studentService = require('../src/modules/students/student.service');
const jobService = require('../src/modules/jobs/job.service');
const { truncateAll } = require('./helpers');

function attachQueryCounter() {
  let count = 0;
  const listener = () => { count += 1; };
  prisma.$on('query', listener);
  return {
    get: () => count,
    reset: () => { count = 0; },
  };
}

async function seedStudentsWithApplications(n) {
  // Skills first
  const skillRows = ['Node.js', 'React', 'PostgreSQL'].map((name) => ({ name }));
  await prisma.skill.createMany({ data: skillRows, skipDuplicates: true });
  const skills = await prisma.skill.findMany();

  const company = await prisma.company.create({
    data: { name: `C-${Date.now()}-${Math.random()}`, industry: 'X', city: 'Y' },
  });

  // A pool of jobs
  const jobs = [];
  for (let j = 0; j < 5; j += 1) {
    jobs.push(await prisma.job.create({
      data: {
        companyId: company.id, title: `Job ${j}`, city: 'Y',
        type: 'INTERNSHIP', deadline: new Date('2027-12-31'),
        jobSkills: { create: skills.slice(0, 2).map((s) => ({ skillId: s.id })) },
      },
    }));
  }

  for (let i = 0; i < n; i += 1) {
    const student = await prisma.student.create({
      data: {
        name: `S${i}`, email: `s${i}-${Date.now()}@x.edu`,
        branch: 'CS', graduationYear: 2027, cgpa: 8.0,
        studentSkills: { create: skills.slice(0, 2).map((s) => ({ skillId: s.id })) },
      },
    });
    for (let j = 0; j < 3; j += 1) {
      await prisma.application.create({
        data: { studentId: student.id, jobId: jobs[j].id },
      });
    }
  }
}

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

describe('N+1: query count does NOT grow with row count', () => {
  test('listStudents with 5 rows uses the same query count as with 25', async () => {
    // Warm-up (some Prisma queries fire on first call)
    await prisma.student.findMany({ take: 1 });

    await seedStudentsWithApplications(5);

    const counter = attachQueryCounter();
    counter.reset();

    const q = {
      page: 1, limit: 25, offset: 0,
      sort: [{ field: 'createdAt', direction: 'desc' }],
      filters: {}, fields: null, expand: [], search: null,
    };
    await studentService.listStudents(q);
    const withFive = counter.get();

    // Seed 20 more → 25 total
    await seedStudentsWithApplications(20);

    counter.reset();
    await studentService.listStudents(q);
    const withTwentyFive = counter.get();

    // The whole point: more rows must not mean more queries.
    // Tolerance of 1 in case of internal Prisma bookkeeping.
    expect(withTwentyFive - withFive).toBeLessThanOrEqual(1);
  });

  test('recommendedForStudent uses a small bounded number of queries', async () => {
    await seedStudentsWithApplications(3);
    const student = await prisma.student.findFirst();

    const counter = attachQueryCounter();
    counter.reset();
    await jobService.recommendedForStudent(student.id);

    // 1 findStudent + 1 findSkillIds + 1 findJobsWithOverlap = ~3-4 queries.
    // The assertion: no dependence on number of matching jobs or skills.
    expect(counter.get()).toBeLessThan(8);
  });
});
