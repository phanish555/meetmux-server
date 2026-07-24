const prisma = require('../src/shared/prisma');

// Children first — FK constraints enforce the order
async function truncateAll() {
  await prisma.applicationEvent.deleteMany();
  await prisma.interview.deleteMany();
  await prisma.application.deleteMany();
  await prisma.studentSkill.deleteMany();
  await prisma.jobSkill.deleteMany();
  await prisma.job.deleteMany();
  await prisma.company.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.student.deleteMany();
  await prisma.user.deleteMany();
  await prisma.skill.deleteMany();
}

async function seedCompanyAndJob({ openings = 2 } = {}) {
  const company = await prisma.company.create({
    data: {
      name: 'Test Co', industry: 'Testing', city: 'Bengaluru',
      employeeCount: 10, verified: true,
    },
  });
  const job = await prisma.job.create({
    data: {
      companyId: company.id, title: 'Test Job', city: 'Bengaluru',
      type: 'INTERNSHIP', openings, deadline: new Date('2027-12-31'),
    },
  });
  return { company, job };
}

async function seedStudent(overrides = {}) {
  return prisma.student.create({
    data: {
      name: 'Test Student',
      email: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.edu`,
      branch: 'Computer Science',
      graduationYear: 2026,
      cgpa: 8.5,
      ...overrides,
    },
  });
}

module.exports = { prisma, truncateAll, seedCompanyAndJob, seedStudent };
