// Demonstrates that the database enforces integrity even when the API is bypassed.
// Every attempt below is intentionally invalid; the DB should reject each one.

const prisma = require('../src/shared/prisma');

const attempts = [
  {
    name: 'CGPA above 10 is rejected (CHECK)',
    run: () => prisma.student.create({
      data: {
        name: 'Bad Data', email: 'bad-cgpa@x.edu', branch: 'CSE',
        graduationYear: 2026, cgpa: 47,
      },
    }),
  },
  {
    name: 'Malformed email is rejected (CHECK)',
    run: () => prisma.student.create({
      data: {
        name: 'Bad Email', email: 'not-an-email', branch: 'CSE',
        graduationYear: 2026,
      },
    }),
  },
  {
    name: 'Duplicate email is rejected (UNIQUE)',
    run: () => prisma.student.create({
      data: {
        name: 'Clone', email: 'aarav.sharma@example.edu',
        branch: 'CSE', graduationYear: 2026,
      },
    }),
  },
  {
    name: 'Application to a non-existent job is rejected (FK)',
    run: async () => {
      const s = await prisma.student.findFirst();
      return prisma.application.create({
        data: { studentId: s.id, jobId: 'job_does_not_exist' },
      });
    },
  },
  {
    name: 'Applying twice to the same job is rejected (composite UNIQUE)',
    run: async () => {
      const a = await prisma.application.findFirst();
      return prisma.application.create({
        data: { studentId: a.studentId, jobId: a.jobId },
      });
    },
  },
  {
    name: 'Deleting a company with jobs is rejected (FK RESTRICT)',
    run: async () => {
      const c = await prisma.company.findFirst({ include: { jobs: true } });
      return prisma.company.delete({ where: { id: c.id } });
    },
  },
  {
    name: 'Zero openings is rejected (CHECK)',
    run: async () => {
      const c = await prisma.company.findFirst();
      return prisma.job.create({
        data: {
          companyId: c.id, title: 'Bad Job', city: 'Pune',
          type: 'INTERNSHIP', openings: 0,
          deadline: new Date('2027-12-01'),
        },
      });
    },
  },
  {
    name: 'Negative stipend is rejected (CHECK)',
    run: async () => {
      const c = await prisma.company.findFirst();
      return prisma.job.create({
        data: {
          companyId: c.id, title: 'Negative Stipend', city: 'Pune',
          type: 'INTERNSHIP', stipendPaise: -100, openings: 1,
          deadline: new Date('2027-12-01'),
        },
      });
    },
  },
  {
    name: 'Interview round 0 is rejected (CHECK)',
    run: async () => {
      const app = await prisma.application.findFirst();
      return prisma.interview.create({
        data: {
          applicationId: app.id, round: 0,
          scheduledAt: new Date('2027-01-01T09:00:00Z'),
        },
      });
    },
  },
  {
    name: 'Duplicate interview round for an application is rejected (composite UNIQUE)',
    run: async () => {
      const existing = await prisma.interview.findFirst();
      return prisma.interview.create({
        data: {
          applicationId: existing.applicationId, round: existing.round,
          scheduledAt: new Date('2027-01-01T09:00:00Z'),
        },
      });
    },
  },
  {
    name: 'Non-WITHDRAWN status with withdrawn_at set is rejected (cross-column CHECK)',
    run: async () => {
      const app = await prisma.application.findFirst();
      return prisma.application.update({
        where: { id: app.id },
        data: { withdrawnAt: new Date() }, // status is still non-WITHDRAWN
      });
    },
  },
];

(async () => {
  let blocked = 0;
  for (const attempt of attempts) {
    try {
      await attempt.run();
      console.log(`✗ LEAKED  — ${attempt.name}`);
    } catch (err) {
      blocked += 1;
      const reason = err.meta?.constraint || err.meta?.target || err.code || err.message.split('\n')[0];
      console.log(`✓ BLOCKED — ${attempt.name}  [${reason}]`);
    }
  }
  console.log(`\n${blocked}/${attempts.length} bad writes rejected by the database.`);
  await prisma.$disconnect();
  process.exit(blocked === attempts.length ? 0 : 1);
})();
